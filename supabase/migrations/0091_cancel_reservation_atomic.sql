-- ============================================================================
-- 0091 · Cancel·lar una reserva en una sola transacció, i esperes del centre
-- ============================================================================
--
-- TRES COSES, I LES TRES VÉNEN DE LA 0090
--
-- 1. `waitlist_entries.cancelled_by_center`. Quan el centre tanca una franja,
--    les esperes d'aquella hora es tanquen amb el mateix 'cancelled' que fa
--    servir el client en desapuntar-se, i no hi ha manera de distingir-les.
--    L'allargament de sèries les comptava totes com a ocurrències col·locades:
--    reproduït, una sèrie de 3 amb una espera tancada pel centre es quedava en
--    2 sessions i l'allargament deia «límit assolit». Mateixa marca i mateix
--    CHECK de coherència que `reservations.cancelled_by_center`.
--
-- 2. `cancel_reservations_core`: el cor de la cancel·lació (reserves + sessions
--    als bons en una sola sentència), tret de la 0090 perquè el facin servir
--    les DUES portes. Abans vivia dins de `cancel_reservations_by_center`; ara
--    aquella el crida, amb el mateix comportament. No el pot cridar ningú de
--    fora: no té cap permís propi, només les portes en tenen.
--
-- 3. `cancel_reservation`: la cancel·lació NORMAL (el client la seva, el
--    professional les de la seva agenda i les dels seus clients, l'admin
--    qualsevol). Fins ara eren dos UPDATE des de l'aplicació —la reserva i
--    després el bo—, i si el segon fallava la reserva quedava cancel·lada i la
--    sessió perduda. A més, el retorn al bo era llegir-i-escriure: dues
--    cancel·lacions simultànies del mateix bo podien perdre'n una. I la del
--    client no filtrava per 'booked' en l'UPDATE: dues cancel·lacions
--    simultànies de la mateixa reserva podien tornar la sessió dues vegades.
--    Aquí tot va en una transacció, amb la fila bloquejada des que es mira fins
--    que es cancel·la.
--
-- EL PERMÍS DEL PROFESSIONAL S'AMPLIA, I ÉS A POSTA
--
-- Fins ara el professional només podia cancel·lar les reserves dels seus
-- clients ASSIGNATS: la RLS `reservations_trainer_write` de la 0005 no mirava
-- de qui era l'agenda. Aquí també pot cancel·lar qualsevol reserva de la SEVA
-- agenda (`trainer_id = auth.uid()`), encara que el client estigui assignat a
-- un company. És una ampliació deliberada, decidida per Marc, i no un efecte
-- col·lateral: és la mateixa regla que la 0090 ja aplica quan el professional
-- tanca disponibilitat, i no tenia sentit que pogués anul·lar aquella sessió
-- en fer vacances però no un dimarts qualsevol. Qui fa la sessió és qui sap
-- si no la podrà fer.
--
-- La resta es queda com avui: l'admin, tot; el client, les seves, futures i
-- fora del marge `min_cancellation_hours`.
--
-- QUÈ QUEDA A L'APLICACIÓ: el correu i la promoció de la cua, DESPRÉS del
-- commit i només si la cancel·lació ha passat de debò (`ok: true`). Si no, no
-- s'avisa ningú: és el control de la 0090 («zero files → error, sense correu»),
-- ara dit per la base amb un motiu concret.
-- ============================================================================

-- ─── 1. Esperes tancades pel centre ──────────────────────────────────────────

alter table public.waitlist_entries
  add column if not exists cancelled_by_center boolean not null default false;

comment on column public.waitlist_entries.cancelled_by_center is
  'L''espera la va tancar el centre en tancar disponibilitat (0090/0091), no el client. No compta per al total d''una sèrie.';

alter table public.waitlist_entries
  drop constraint if exists waitlist_cancelled_by_center_status;
alter table public.waitlist_entries
  add constraint waitlist_cancelled_by_center_status
  check (not cancelled_by_center or status = 'cancelled');

-- ─── 2. El cor compartit ─────────────────────────────────────────────────────

create or replace function public.cancel_reservations_core(
  p_ids          uuid[],
  -- Null = qualsevol agenda (la porta ja ha decidit el permís).
  p_trainer_id   uuid,
  p_by_center    boolean,
  -- La 0090 només toca el futur; l'equip pot cancel·lar una sessió passada
  -- que ningú va marcar (per exemple, algú que no es va presentar).
  p_future_only  boolean,
  p_today        date
)
returns table (
  reservation_id   uuid,
  client_id        uuid,
  bono_id          uuid,
  trainer_id       uuid,
  series_id        uuid,
  scheduled_at     timestamptz,
  service_type     public.service_type,
  refunded         boolean,
  bono_expired     boolean
)
language plpgsql
set search_path = public
as $$
begin
  return query
  with cancelled as (
    update public.reservations r
       set status = 'cancelled',
           cancelled_by_center = p_by_center
     where r.id = any(p_ids)
       and (p_trainer_id is null or r.trainer_id = p_trainer_id)
       and r.status = 'booked'
       and (not p_future_only or r.scheduled_at > now())
    returning r.id, r.client_id, r.bono_id, r.trainer_id, r.series_id,
              r.scheduled_at, r.service_type
  ),
  per_bono as (
    select c.bono_id, count(*)::integer as n
      from cancelled c
     where c.bono_id is not null
     group by c.bono_id
  ),
  restored as (
    -- Sostre a `total_sessions`, 'completed' torna a 'active', 'expired' es
    -- queda 'expired'. Dins d'un sol UPDATE: sense la cursa de llegir-i-escriure.
    update public.bonos b
       set remaining_sessions = least(b.remaining_sessions + pb.n, b.total_sessions),
           status = case
                      when b.status = 'completed' then 'active'::public.bono_status
                      else b.status
                    end
      from per_bono pb
     where b.id = pb.bono_id
    returning b.id, b.status, b.expires_at
  )
  select c.id, c.client_id, c.bono_id, c.trainer_id, c.series_id,
         c.scheduled_at, c.service_type,
         c.bono_id is not null,
         coalesce(
           rb.status = 'expired'
           or (rb.expires_at is not null and rb.expires_at < p_today),
           false
         )
    from cancelled c
    left join restored rb on rb.id = c.bono_id
   order by c.scheduled_at;
end;
$$;

comment on function public.cancel_reservations_core(uuid[], uuid, boolean, boolean, date) is
  'Cor de la cancel·lació: reserves ''booked'' + sessions als bons, en una sentència. SENSE permís propi: només el criden cancel_reservations_by_center (0090) i cancel_reservation (0091).';

-- Ningú no hi entra directament. Les portes (security definer) l'executen com
-- el seu propietari, que n'és el mateix.
revoke all on function public.cancel_reservations_core(uuid[], uuid, boolean, boolean, date) from public;
revoke all on function public.cancel_reservations_core(uuid[], uuid, boolean, boolean, date) from anon;
revoke all on function public.cancel_reservations_core(uuid[], uuid, boolean, boolean, date) from authenticated;
revoke all on function public.cancel_reservations_core(uuid[], uuid, boolean, boolean, date) from service_role;

-- ─── 3. La 0090, ara sobre el cor (mateixa signatura, mateix comportament) ───

create or replace function public.cancel_reservations_by_center(
  p_trainer_id uuid,
  p_ids        uuid[],
  p_today      date
)
returns table (
  reservation_id   uuid,
  client_id        uuid,
  bono_id          uuid,
  trainer_id       uuid,
  series_id        uuid,
  scheduled_at     timestamptz,
  service_type     public.service_type,
  refunded         boolean,
  bono_expired     boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_trainer_id is null then
    raise exception 'cancel_reservations_by_center: falta el professional.'
      using errcode = '22004';
  end if;
  if auth.uid() is null then
    raise exception 'cancel_reservations_by_center: cal una sessió d''usuari.'
      using errcode = '42501';
  end if;
  if not (
    public.is_admin()
    or (public.is_trainer() and auth.uid() = p_trainer_id)
  ) then
    raise exception 'cancel_reservations_by_center: no autoritzat.'
      using errcode = '42501';
  end if;

  return query
  select * from public.cancel_reservations_core(p_ids, p_trainer_id, true, true, p_today);
end;
$$;

-- ─── 4. La cancel·lació normal ───────────────────────────────────────────────

create or replace function public.cancel_reservation(
  p_id    uuid,
  -- El dia del CENTRE (per dir si el bo ha caducat), com a la 0090.
  p_today date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res    public.reservations%rowtype;
  v_actor  text;
  v_min    integer;
  v_row    record;
begin
  if auth.uid() is null then
    raise exception 'cancel_reservation: cal una sessió d''usuari.'
      using errcode = '42501';
  end if;

  -- La fila queda bloquejada des d'aquí fins al final: el que es comprova és
  -- el que es cancel·la, sense que ningú la pugui tocar entremig.
  select * into v_res from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Qui ho fa. El professional: els seus clients assignats (la regla de la
  -- 0005) o la seva pròpia agenda (l'ampliació d'aquesta migració, vegeu la
  -- capçalera). El client: les comprovacions de `cancelClientReservation`.
  if public.is_admin() then
    v_actor := 'admin';
  elsif public.is_trainer()
        and (public.is_trainer_of(v_res.client_id) or v_res.trainer_id = auth.uid()) then
    v_actor := 'trainer';
  elsif public.owns_client(v_res.client_id) then
    v_actor := 'client';
  else
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if v_res.status <> 'booked' then
    return jsonb_build_object('ok', false, 'reason', 'not_booked');
  end if;

  if v_actor = 'client' then
    if v_res.scheduled_at <= now() then
      return jsonb_build_object('ok', false, 'reason', 'past');
    end if;
    select min_cancellation_hours into v_min from public.center_settings limit 1;
    if coalesce(v_min, 0) > 0
       and v_res.scheduled_at - now() < make_interval(hours => v_min) then
      return jsonb_build_object('ok', false, 'reason', 'too_late', 'hours', v_min);
    end if;
  end if;

  select * into v_row
    from public.cancel_reservations_core(array[p_id], null, false, false, p_today);
  if not found then
    -- No hi hauria d'arribar mai: la fila és bloquejada i era 'booked'.
    return jsonb_build_object('ok', false, 'reason', 'not_booked');
  end if;

  return jsonb_build_object(
    'ok', true,
    'actor', v_actor,
    'reservation_id', v_row.reservation_id,
    'client_id', v_row.client_id,
    'bono_id', v_row.bono_id,
    'trainer_id', v_row.trainer_id,
    'scheduled_at', v_row.scheduled_at,
    'service_type', v_row.service_type,
    'refunded', v_row.refunded,
    'bono_expired', v_row.bono_expired
  );
end;
$$;

comment on function public.cancel_reservation(uuid, date) is
  'Cancel·lació normal d''una reserva en una sola transacció (reserva + sessió al bo). Permís a dins: admin tot; professional, els seus clients assignats i qualsevol reserva de la seva agenda; client, les seves, futures i fora de min_cancellation_hours. Retorna {ok:true, ...} o {ok:false, reason: not_found|forbidden|not_booked|past|too_late}.';

revoke all on function public.cancel_reservation(uuid, date) from public;
revoke all on function public.cancel_reservation(uuid, date) from anon;
grant execute on function public.cancel_reservation(uuid, date) to authenticated;
