-- ============================================================================
-- VindiBCN · 0097 — Els recomptes i els imports de bons els fa la base
--
-- FINS ARA
--
-- Supabase talla cada lectura a 1000 files (Settings → API → Max rows) i no ho
-- diu. Inici (`getAdminDashboard`) portava tots els bons pendents de pagament i
-- en sumava el preu per al «Pendent de cobrament». Amb més de 1000 pendents,
-- l'import hauria quedat curt sense avisar. A més, sumava NOMÉS els
-- 'pending_payment' (també els ja caducats per data) i no els 'unpaid': no era
-- la mateixa cua que la piloteta del menú (`countCollectableNow`).
--
-- QUÈ CANVIA
--
-- 1. `bonos_summary()`: una fila per cada estat de bo (active, completed,
--    cancelled, pending_payment, expired, unpaid), també els que no en tenen
--    cap (a zero), amb quants n'hi ha i la suma dels preus.
--
--    L'estat que compta és l'EFECTIU: un bo 'active' o 'pending_payment' amb
--    la data de caducitat passada (dia de Madrid) compta com a 'expired',
--    encara que l'escombrat peresós (`sweepExpiredBonos`) no hi hagi passat.
--    És la mateixa regla que `isBonoExpired` a l'app.
--
--    Inici en treu el «Pendent de cobrament» sumant les files
--    'pending_payment' i 'unpaid'. Amb l'estat efectiu, això és EXACTAMENT el
--    criteri de `countCollectableNow` (lib/data/bonos.ts): estat cobrable
--    (pendent o decaigut) i no caducat; els 'unpaid' no caduquen. Si un dels
--    dos canvia, l'altre també.
--
--    Els comptadors dels filtres de les pantalles de bons (admin i
--    professional) NO surten d'aquí: són de tot el centre, els veu també el
--    professional, i ja els dona `countCollectableNow` amb la sessió de qui
--    mira, sense baixar cap fila.
--
-- 2. Índexs per al cursor de la llista de bons («Carregar més»), que ordena
--    per (created_at desc, id desc): un per a la llista sencera i un per a la
--    llista filtrada per estat.
--
-- NOMÉS L'ADMIN, com la 0095: comprova `coalesce(is_admin(), false)` i, si no,
-- llança 42501. Des del principi amb `coalesce`: sense perfil al darrere
-- (`auth.uid()` null, com la clau de servei, o una sessió sense fila a
-- `profiles`) is_admin() torna NULL, i `if not NULL` no entra. No torna un
-- zero: la RLS de `bonos` deixa llegir al client només els seus, i un import
-- fet amb el que veu cadascú seria un número que sembla bo i no ho és. Els
-- imports pendents són del negoci: el tauler del professional no els ensenya.
-- `security invoker`: corre amb els permisos de qui crida.
--
-- ES POT APLICAR DUES VEGADES: `create index if not exists` i
-- `create or replace function`, amb la mateixa signatura i tipus de retorn.
-- ============================================================================

-- ─── 1. Índexs per al cursor de la llista ───────────────────────────────────

create index if not exists bonos_created_at_id_idx
  on public.bonos (created_at desc, id desc);

create index if not exists bonos_status_created_at_id_idx
  on public.bonos (status, created_at desc, id desc);

-- ─── 2. Recomptes i imports per estat ───────────────────────────────────────

create or replace function public.bonos_summary()
returns table (
  status public.bono_status,
  n      bigint,
  amount numeric(12, 2)
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  -- El dia del centre: un bo caduca a la mitjanit de Madrid.
  v_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'bonos_summary: només l''admin'
      using errcode = '42501';
  end if;

  -- Els estats surten de l'enum, no dels bons: un estat sense cap bo hi és
  -- igual, a zero.
  return query
    with effective as (
      select case
               when b.status in ('active', 'pending_payment')
                    and b.expires_at is not null
                    and b.expires_at < v_today
                 then 'expired'::public.bono_status
               else b.status
             end as st,
             b.price
        from public.bonos b
    ),
    sums as (
      select st, count(*) as n, sum(price) as amount
        from effective
       group by st
    )
    select s.st,
           coalesce(sums.n, 0)::bigint,
           coalesce(sums.amount, 0)::numeric(12, 2)
      from unnest(enum_range(null::public.bono_status)) as s(st)
      left join sums on sums.st = s.st
     order by s.st;
end;
$$;

comment on function public.bonos_summary() is
  'Quants bons i quin import hi ha a cada estat (efectiu: caducats per data inclosos), amb els buits a zero. Només admin (0097).';

-- ─── 3. Qui la pot cridar ───────────────────────────────────────────────────
-- Mateix patró que la 0065 i la 0095: fora `public` i `anon`; `authenticated`
-- sí, i dins la funció només passa l'admin.

revoke all on function public.bonos_summary() from public, anon;
grant execute on function public.bonos_summary() to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓ
--
-- A) Només lectura, com a propietari: el que ha de donar (amb la mateixa regla
--    de caducitat).
--
--   select case when status in ('active','pending_payment')
--                    and expires_at is not null
--                    and expires_at < (now() at time zone 'Europe/Madrid')::date
--               then 'expired' else status::text end as st,
--          count(*), sum(price)
--     from public.bonos group by 1 order by 1;
--
-- B) La funció com a ADMIN, en una transacció que es desfà:
--
--   begin;
--   do $$ begin perform set_config('request.jwt.claims',
--     '{"sub":"<UUID_ADMIN>","role":"authenticated"}', true); end $$;
--   set local role authenticated;
--   select auth.uid(), * from public.bonos_summary();
--   rollback;
--
-- C) Com a CLIENT, ENTRENADOR, o amb la clau de servei: error 42501, no zeros.
-- D) Tornar a executar tot el fitxer: sense errors.
-- ----------------------------------------------------------------------------
