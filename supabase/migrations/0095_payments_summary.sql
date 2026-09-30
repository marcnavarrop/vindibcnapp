-- ============================================================================
-- VindiBCN · 0095 — Els totals de pagaments els compta la base
--
-- FINS ARA
--
-- Supabase talla cada lectura a 1000 files (Settings → API → Max rows) i no ho
-- diu. Dues pantalles sumaven pagaments al servidor de l'app a partir d'una
-- llista sense límit:
--
--   · /admin/pagos portava TOTS els pagaments (`listPayments`) i en sumava
--     l'import per al «X € cobrat». Amb 1001 pagaments, el total deixaria de
--     ser el total i ningú ho veuria.
--   · Inici (`getAdminDashboard`) portava els pagaments des de l'1 del mes
--     anterior i en treia els ingressos d'aquest mes, els de l'anterior i el %.
--     Un mes amb més de 1000 cobraments quedaria curt.
--
-- QUÈ CANVIA
--
-- 1. `payments_summary(p_from, p_to, p_method)`: el total, el nombre de
--    pagaments i el desglossament per targeta i efectiu d'un interval opcional
--    de `paid_at`. Una sola fila. Amb `p_method`, compta només aquell mètode (i
--    l'altre surt a zero).
-- 2. `payments_by_month(p_months)`: el total i el nombre de pagaments de cada
--    mes natural EN HORA DE MADRID, dels últims `p_months` mesos (el que corre
--    inclòs), del més antic al més nou, amb els mesos sense cap pagament a
--    zero. Inici en demana 2: aquest mes, l'anterior, i el % surt d'aquí.
-- 3. Índex (paid_at desc, id desc): el farà servir el cursor de la llista de
--    pagaments («Carregar més»), que ordena per aquí i desempata per id.
--
-- NOMÉS L'ADMIN. Les dues funcions comproven `is_admin()` i, si no, llancen
-- un error 42501. També quan `is_admin()` torna NULL: passa sempre que no hi ha
-- perfil al darrere (`auth.uid()` null, com la clau de servei, o un usuari
-- d'Auth sense fila a `profiles`), i en plpgsql `if not NULL` no entra. La
-- primera versió aplicada ho deixava passar; es va veure provant-la amb la
-- clau de servei a producció.
--
-- No tornen un zero: la RLS de `payments` (0001) deixa llegir al client els
-- seus i a l'entrenador els dels seus clients, i un «total» fet només amb el
-- que veu cadascú seria un número que sembla bo i no ho és.
-- `security invoker`: corren amb els permisos de qui crida; la comprovació és
-- a sobre de la RLS, no en comptes d'ella.
--
-- ES POT APLICAR DUES VEGADES: `create index if not exists` i
-- `create or replace function`, amb les mateixes signatures i tipus de retorn.
-- ============================================================================

-- ─── 1. Índex per al cursor de la llista ────────────────────────────────────

create index if not exists payments_paid_at_id_idx
  on public.payments (paid_at desc, id desc);

-- ─── 2. Totals d'un interval ────────────────────────────────────────────────

create or replace function public.payments_summary(
  p_from   timestamptz default null,           -- inclòs; null = des del principi
  p_to     timestamptz default null,           -- exclòs; null = fins ara i després
  p_method public.payment_method default null  -- null = tots dos
)
returns table (
  total      numeric(12, 2),
  n          bigint,
  card_total numeric(12, 2),
  card_n     bigint,
  cash_total numeric(12, 2),
  cash_n     bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  -- `coalesce`: sense perfil (auth.uid() null, com la clau de servei)
  -- is_admin() torna NULL, i `if not NULL` no entra: passaria de llarg.
  if not coalesce(public.is_admin(), false) then
    raise exception 'payments_summary: només l''admin'
      using errcode = '42501';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'payments_summary: p_from (%) és posterior a p_to (%)', p_from, p_to
      using errcode = '22023';
  end if;

  return query
    select coalesce(sum(p.amount), 0)::numeric(12, 2),
           count(*),
           coalesce(sum(p.amount) filter (where p.method = 'card'), 0)::numeric(12, 2),
           count(*) filter (where p.method = 'card'),
           coalesce(sum(p.amount) filter (where p.method = 'cash'), 0)::numeric(12, 2),
           count(*) filter (where p.method = 'cash')
      from public.payments p
     where (p_from   is null or p.paid_at >= p_from)
       and (p_to     is null or p.paid_at <  p_to)
       and (p_method is null or p.method  =  p_method);
end;
$$;

comment on function public.payments_summary(timestamptz, timestamptz, public.payment_method) is
  'Total, nombre i desglossament targeta/efectiu dels pagaments d''un interval de paid_at. Només admin (0095).';

-- ─── 3. Totals per mes natural (hora de Madrid) ─────────────────────────────

create or replace function public.payments_by_month(
  p_months integer  -- quants mesos, el que corre inclòs: 1..36
)
returns table (
  month date,            -- l'1 del mes, en hora de Madrid
  total numeric(12, 2),
  n     bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  -- L'1 del mes que corre, com a data local de Madrid.
  v_this  date := date_trunc('month', now() at time zone 'Europe/Madrid')::date;
  v_first date;
begin
  -- `coalesce`: sense perfil (auth.uid() null, com la clau de servei)
  -- is_admin() torna NULL, i `if not NULL` no entra: passaria de llarg.
  if not coalesce(public.is_admin(), false) then
    raise exception 'payments_by_month: només l''admin'
      using errcode = '42501';
  end if;

  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'payments_by_month: p_months ha d''anar d''1 a 36 (és %)', p_months
      using errcode = '22023';
  end if;

  v_first := (v_this - make_interval(months => p_months - 1))::date;

  -- Els mesos surten de la sèrie, no dels pagaments: un mes sense cap cobrament
  -- hi és igual, a zero. El tall de cada pagament es fa en hora de Madrid (un
  -- cobrament del 31 a les 23:30 és d'aquell mes, encara que en UTC ja sigui
  -- l'1). El `where` converteix els límits locals a instants perquè l'índex de
  -- paid_at serveixi.
  return query
    with months as (
      select generate_series(v_first::timestamp, v_this::timestamp, interval '1 month')::date as m
    ),
    sums as (
      select date_trunc('month', p.paid_at at time zone 'Europe/Madrid')::date as m,
             sum(p.amount) as total,
             count(*)      as n
        from public.payments p
       where p.paid_at >= (v_first::timestamp at time zone 'Europe/Madrid')
         and p.paid_at <  ((v_this + interval '1 month')::timestamp at time zone 'Europe/Madrid')
       group by 1
    )
    select months.m,
           coalesce(sums.total, 0)::numeric(12, 2),
           coalesce(sums.n, 0)::bigint
      from months
      left join sums on sums.m = months.m
     order by months.m;
end;
$$;

comment on function public.payments_by_month(integer) is
  'Total i nombre de pagaments de cada mes natural (Europe/Madrid) dels últims p_months mesos, amb els buits a zero. Només admin (0095).';

-- ─── 4. Qui les pot cridar ──────────────────────────────────────────────────
-- Mateix patró que la 0065: fora `public` i `anon`; `authenticated` sí, i
-- dins la funció només passa l'admin.

revoke all on function public.payments_summary(timestamptz, timestamptz, public.payment_method) from public, anon;
grant execute on function public.payments_summary(timestamptz, timestamptz, public.payment_method) to authenticated;

revoke all on function public.payments_by_month(integer) from public, anon;
grant execute on function public.payments_by_month(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓ
--
-- A) Només lectura, com a propietari (fora de les funcions): el que han de
--    donar.
--
--   select count(*), sum(amount),
--          sum(amount) filter (where method = 'card'),
--          sum(amount) filter (where method = 'cash')
--     from public.payments;
--
-- B) Les funcions, com a ADMIN, en una transacció que es desfà. Un script per
--    cas (el SQL Editor s'atura al primer error i només ensenya una taula).
--
--   begin;
--   do $$ begin perform set_config('request.jwt.claims',
--     '{"sub":"<UUID_ADMIN>","role":"authenticated"}', true); end $$;
--   set local role authenticated;
--   select auth.uid(), * from public.payments_summary();
--   rollback;
--
--   (i el mateix amb `select auth.uid(), * from public.payments_by_month(2);`)
--
-- C) Com a CLIENT o ENTRENADOR (mateix script amb el seu uuid): ha de fallar
--    amb 42501 «només l'admin», no tornar zeros.
-- D) `payments_by_month(0)` i `payments_by_month(37)`: error 22023.
-- E) Tornar a executar tot el fitxer: sense errors.
-- ----------------------------------------------------------------------------
