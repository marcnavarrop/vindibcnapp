-- ============================================================================
-- VindiBCN · 0073 — Reclamar una sessió extra, per torns
--
-- Un subscriptor de 8 sessions que en vol una novena abans de renovar la paga
-- al PREU PER SESSIÓ del seu bo base, no al d'una sessió solta. El centre
-- decideix quantes n'admet per cicle (`subscription_extra_sessions_max`, 1 per
-- defecte).
--
-- PER QUÈ UNA FUNCIÓ AMB PANY I NO UN `if` A L'APLICACIÓ
--
-- Perquè comprovar i després inserir és la mateixa cursa que la 0053 va treure
-- de l'aforament dels grups: entre el recompte d'extres i l'INSERT no hi ha
-- res, i dues peticions simultànies veuen totes dues "cap extra encara". Amb el
-- límit a 1 el dany màxim és una sessió de més que el client paga igual, o
-- sigui que això no és un forat de diners. Es fa igualment perquè la regla de
-- la casa és que aquestes garanties les doni la base, i perquè el límit és
-- configurable: amb la funció, posar-lo a 3 no reobre res.
--
-- Es serialitza per SUBSCRIPCIÓ i no per franja: el que es reparteix aquí és la
-- quota d'un client, i dos clients diferents no s'han d'esperar mai.
--
-- QUÈ CREA, I EN QUIN ESTAT
--
-- Un bo a part d'UNA sessió, mai una modificació del bo base. Així no es toca
-- res del que ja funciona: el consum FIFO agafa primer el bo base (és més
-- antic) i només cau a l'extra quan aquell s'acaba, que és l'ordre correcte; la
-- caducitat, l'escombrat de la 0044, el pany de l'aforament i `payments`
-- funcionen sense assabentar-se de res.
--
-- Neix 'pending_payment' SEMPRE, també quan es pagarà amb targeta. És la
-- diferència amb la compra d'un bo normal, on obrir la sessió de Checkout no
-- crea res, i té un motiu concret: aquí el que s'ha de reclamar de manera
-- atòmica no és el pagament sinó la PLAÇA dins de la quota del cicle. Si
-- esperéssim al webhook, el client podria pagar i trobar-se que entremig se li
-- ha exhaurit el límit: diners cobrats i cap sessió. Reclamant primer, el pitjor
-- cas és un bo pendent que ningú paga.
--
-- I aquell pitjor cas es tanca sol: com que només es pot demanar un extra quan
-- el cicle ja no té cap sessió (regla de sota), un extra pendent deixa el
-- comptador a 1 i impedeix demanar-ne un altre. El client el pot pagar al
-- centre quan vulgui, i si no, caduca amb el cicle. L'admin sempre el pot
-- anul·lar a mà.
--
-- QUAN ES POT DEMANAR
--
-- Només amb el cicle EXHAURIT: cap sessió disponible en cap bo d'aquest cicle.
-- No és una limitació tècnica; és el que fa que "extra" vulgui dir extra i no
-- "avançar-me la compra del mes que ve".
-- ============================================================================

create or replace function public.claim_subscription_extra(
  p_subscription_id uuid,
  p_cycle_start     date,
  -- El dia del CENTRE, que arriba de fora. No es calcula aquí: la zona és
  -- configurable per variable d'entorn (CENTER_TIMEZONE) i un
  -- `now() at time zone 'Europe/Madrid'` clavat al DDL seria una segona
  -- veritat, capaç d'anar-se'n de la primera sense que ho vegi ningú.
  p_today           date,
  p_max_extras      integer,
  p_price           numeric,
  p_expires_at      date
)
returns jsonb
language plpgsql
as $$
declare
  v_sub       public.subscriptions%rowtype;
  v_left      integer;
  v_extras    integer;
  v_id        uuid;
begin
  -- El torn. `xact` com a la 0053: es deixa anar sol quan acaba la transacció,
  -- sense haver de recordar alliberar-lo enlloc.
  perform pg_advisory_xact_lock(
    hashtextextended('subscription_extra|' || p_subscription_id::text, 0)
  );

  -- A partir d'aquí ningú més està mirant la quota d'aquesta subscripció.
  select * into v_sub
    from public.subscriptions
   where id = p_subscription_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Una subscripció aturada per impagament o ja cancel·lada no reparteix
  -- res més. La cancel·lada conserva el cicle pagat per FER-LO servir, no per
  -- ampliar-lo.
  if v_sub.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  -- El cicle que ens demanen ha de ser el que corre ara. Si no ho és, qui ens
  -- crida llegia una pantalla d'abans de la renovació i el que veia ja no és
  -- veritat: val més dir-l'hi que servir-lo contra un mes tancat.
  if v_sub.current_cycle_start <> p_cycle_start then
    return jsonb_build_object('ok', false, 'reason', 'stale_cycle');
  end if;

  -- Sessions que encara queden al cicle, en qualsevol bo seu (el base i els
  -- extres que ja hi hagi). Els estats són els mateixos que `USABLE` a
  -- lib/data/bonos.ts, i la condició de caducitat, la mateixa que
  -- `isBonoExpired`: sense data no caduca, i amb data ha de ser d'avui o
  -- posterior.
  --
  -- El filtre de caducitat sembla redundant —un bo caducat ja hauria de tenir
  -- l'estat 'expired' i quedar fora del `status in`— però no ho és:
  -- `sweepExpiredBonos` és PERESÓS a posta, o sigui que un bo pot haver passat
  -- de data i encara dir 'active' fins que algú hi passi. És exactament el
  -- motiu pel qual `isBonoExpired` existeix a l'aplicació.
  select coalesce(sum(remaining_sessions), 0) into v_left
    from public.bonos
   where subscription_id = p_subscription_id
     and subscription_cycle_start = p_cycle_start
     and status in ('active', 'pending_payment')
     and (expires_at is null or expires_at >= p_today);

  if v_left > 0 then
    return jsonb_build_object('ok', false, 'reason', 'sessions_left', 'remaining', v_left);
  end if;

  select count(*) into v_extras
    from public.bonos
   where subscription_id = p_subscription_id
     and subscription_cycle_start = p_cycle_start
     and is_subscription_extra = true
     -- Un extra anul·lat per l'admin o decaigut per impagament no gasta quota:
     -- el client no l'ha arribat a tenir.
     and status not in ('cancelled', 'unpaid');

  if v_extras >= p_max_extras then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached', 'used', v_extras);
  end if;

  insert into public.bonos
    (client_id, service_type, total_sessions, remaining_sessions, price, status,
     expires_at, subscription_id, subscription_cycle_start, is_subscription_extra)
  values
    (v_sub.client_id, v_sub.service_type, 1, 1, p_price, 'pending_payment',
     p_expires_at, p_subscription_id, p_cycle_start, true)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'used', v_extras + 1);
end;
$$;

comment on function public.claim_subscription_extra is
  'Reclama una sessió extra del cicle en curs d''una subscripció, serialitzant per subscripció amb un advisory lock. Crea un bo d''1 sessió en pending_payment. Retorna {ok:true,id,used} o {ok:false,reason:not_found|not_active|stale_cycle|sessions_left|limit_reached}.';

-- Crea bons per a qualsevol client que se li passi i decideix una quota: no la
-- pot cridar un navegador. La crida el servidor amb la clau de servei, després
-- de comprovar qui ets i que la subscripció és teva. Mateix tancament que
-- `book_group_slot` a la 0053.
revoke all on function public.claim_subscription_extra(uuid, date, date, integer, numeric, date) from public;
revoke all on function public.claim_subscription_extra(uuid, date, date, integer, numeric, date) from anon;
revoke all on function public.claim_subscription_extra(uuid, date, date, integer, numeric, date) from authenticated;
grant execute on function public.claim_subscription_extra(uuid, date, date, integer, numeric, date) to service_role;
