-- ============================================================================
-- 0101 · Els totals de Pagaments separen la targeta del TPV de la d'internet
--
-- Des del pas 2 del pla d'UX, un cobrament amb la targeta del TPV del taulell
-- és un `card` sense `stripe_payment_id`, i el de Stripe en porta sempre un
-- (`payment_intent` o la factura de la subscripció). La llista de Pagaments ja
-- les distingeix («Targeta (TPV)» / «Targeta (en línia)»); el desglossament
-- dels totals de dalt, que el compta la base (`payments_summary`, 0095), encara
-- les sumava juntes.
--
-- QUÈ CANVIA: `payments_summary` torna quatre columnes més —total i nombre de
-- cada targeta—. Les sis d'abans hi són igual i diuen el mateix (`card_total`
-- segueix sent les dues targetes juntes): el codi que ara hi ha a producció les
-- continua llegint bé abans i després d'aplicar això.
--
-- PER QUÈ `drop` + `create`: Postgres no deixa canviar les columnes que torna
-- una funció amb `create or replace` (42P13). Entre les dues sentències la
-- funció no existeix uns mil·lisegons; la crida que caigui just aquí rep un
-- error i la pantalla diu «Total no disponible», no un zero.
--
-- Idempotent: es pot tornar a executar.
-- ============================================================================

drop function if exists public.payments_summary(timestamptz, timestamptz, public.payment_method);

create function public.payments_summary(
  p_from   timestamptz default null,           -- inclòs; null = des del principi
  p_to     timestamptz default null,           -- exclòs; null = fins ara i després
  p_method public.payment_method default null  -- null = tots dos
)
returns table (
  total             numeric(12, 2),
  n                 bigint,
  card_total        numeric(12, 2),   -- totes dues targetes, com fins ara
  card_n            bigint,
  cash_total        numeric(12, 2),
  cash_n            bigint,
  card_tpv_total    numeric(12, 2),   -- targeta sense identificador de Stripe: el taulell
  card_tpv_n        bigint,
  card_online_total numeric(12, 2),   -- targeta amb identificador de Stripe: per internet
  card_online_n     bigint
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
           count(*) filter (where p.method = 'cash'),
           coalesce(sum(p.amount) filter (where p.method = 'card' and p.stripe_payment_id is null), 0)::numeric(12, 2),
           count(*) filter (where p.method = 'card' and p.stripe_payment_id is null),
           coalesce(sum(p.amount) filter (where p.method = 'card' and p.stripe_payment_id is not null), 0)::numeric(12, 2),
           count(*) filter (where p.method = 'card' and p.stripe_payment_id is not null)
      from public.payments p
     where (p_from   is null or p.paid_at >= p_from)
       and (p_to     is null or p.paid_at <  p_to)
       and (p_method is null or p.method  =  p_method);
end;
$$;

comment on function public.payments_summary(timestamptz, timestamptz, public.payment_method) is
  'Total, nombre i desglossament dels pagaments d''un interval de paid_at: targeta (i, a part, TPV i en línia) i efectiu. Només admin (0095, 0101).';

-- `revoke` ABANS del `grant`: Postgres dona l'execució a PUBLIC per defecte, i
-- una funció creada de nou la torna a tenir.
revoke all on function public.payments_summary(timestamptz, timestamptz, public.payment_method) from public, anon;
grant execute on function public.payments_summary(timestamptz, timestamptz, public.payment_method) to authenticated;
