-- ============================================================================
-- VindiBCN · 0105 — El mateix client no pot tenir dues sessions que es trepitgin
--
-- EL FORAT
--
-- La base ja impedeix que un PROFESSIONAL tingui dues sessions individuals
-- solapades (constraint de la 0082) i que un grup passi de l'aforament (0083),
-- però res no impedeix que un CLIENT tingui dues reserves vives que es
-- trepitgin. L'aplicació ho mirava de maneres diferents segons el camí:
--
--   · el client (camí real), la llista d'espera i la promoció: només el MATEIX
--     instant d'inici (amb mitges hores, una de 9:00 i una de 9:30 passaven);
--   · l'equip (createReservation) i el canvi d'hora (0093): gens;
--   · la simulació i el planificador de sèries: per solapament.
--
-- A producció, a l'octubre del 2026, no n'hi ha cap (0 parells solapats entre
-- 23 reserves vives), però cap camí ho garantia.
--
-- QUÈ HI POSA
--
-- 1. La constraint `reservations_no_client_overlap`: dues reserves 'booked' del
--    mateix client no es poden trepitjar, sigui quin sigui el servei o el
--    professional. Interval semiobert `[)`: una que acaba a les 10:00 i una que
--    hi comença no xoquen. Abans de crear-la es comprova que no hi hagi cap
--    parell que la incompleixi, i si n'hi ha la migració s'atura dient quin.
--    És la xarxa que tapa TOTS els camins, també els que vinguin.
--
-- 2. La comprovació dins de `book_group_slot`, `book_individual_slot` i
--    `reschedule_reservation`, amb el motiu `client_overlap`: és el que veu
--    l'aplicació en el cas normal, abans de tocar cap bo. La constraint queda
--    per a la cursa (dues peticions del mateix client alhora per a dos
--    professionals, que agafen panys diferents): llavors la segona falla amb
--    l'error 23P01 de la constraint, la transacció sencera es desfà (el bo
--    també) i l'aplicació ho tradueix igual.
--
-- EL QUE NO CANVIA
--
-- La firma, el cos, la seguretat i els permisos de les tres funcions: les de
-- reserva segueixen SECURITY INVOKER sense `search_path`, i
-- `reschedule_reservation` segueix amb el seu `set search_path = public`, com
-- a la 0093. Com que la firma no canvia, n'hi ha prou amb `create or replace`
-- i els `grant` es mantenen; es tornen a escriure igualment.
-- ============================================================================

begin;

-- ─── 0. Abans de la constraint: que no hi hagi cap parell que la trenqui ───

do $$
declare
  v record;
begin
  select a.client_id, a.id as a_id, a.scheduled_at as a_at, b.id as b_id, b.scheduled_at as b_at
    into v
    from public.reservations a
    join public.reservations b
      on b.client_id = a.client_id
     and b.id > a.id
     and b.status = 'booked'
     and b.scheduled_at < a.ends_at
     and b.ends_at > a.scheduled_at
   where a.status = 'booked'
   limit 1;
  if found then
    raise exception 'El client % té dues reserves vives solapades (% a %, i % a %). Cal resoldre-ho abans d''aplicar la 0105.',
      v.client_id, v.a_id, v.a_at, v.b_id, v.b_at;
  end if;
end $$;

-- ─── 1. La constraint ───────────────────────────────────────────────────────

-- `btree_gist` ja hi és des de la 0082; es repeteix per si de cas.
create extension if not exists btree_gist;

alter table public.reservations
  drop constraint if exists reservations_no_client_overlap;
alter table public.reservations
  add constraint reservations_no_client_overlap
  exclude using gist (
    client_id with =,
    tstzrange(scheduled_at, ends_at, '[)') with &&
  )
  where (status = 'booked');

comment on constraint reservations_no_client_overlap on public.reservations is
  'Un client no pot tenir dues reserves vives (booked) que es trepitgin, sigui quin sigui el servei o el professional (0105).';

-- ─── 2. book_group_slot ─────────────────────────────────────────────────────

create or replace function public.book_group_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_capacity           integer,
  p_duration_minutes   integer,
  -- El dia del centre (YYYY-MM-DD) per a la caducitat. Obligatori des de la
  -- 0104: ningú no pot reservar amb bo sense dir quin dia és avui al centre.
  p_today              date
)
returns jsonb
language plpgsql
as $$
declare
  v_ocupades   integer;
  v_exclusiva  integer;
  v_bono       public.bonos%rowtype;
  v_id         uuid;
  v_remaining  integer;
  v_end        timestamptz;
  v_trial_mins constant integer := 60;
begin
  if p_trainer_id is null then
    raise exception 'book_group_slot: cal un professional per reservar una plaça de grup.';
  end if;

  v_end := p_scheduled_at + make_interval(mins => p_duration_minutes);

  -- El torn, com a la 0083: per professional, sense l'hora.
  perform pg_advisory_xact_lock(hashtextextended(p_trainer_id::text, 0));

  select
    count(*) filter (where true),
    count(*) filter (where service_type <> 'grupo_reducido')
  into v_ocupades, v_exclusiva
  from (
    select service_type
      from public.reservations
     where trainer_id = p_trainer_id
       and status = 'booked'
       and scheduled_at < v_end
       and ends_at > p_scheduled_at
    union all
    select service_type
      from public.trial_bookings
     where trainer_id = p_trainer_id
       and (status = 'confirmed' or (status = 'pending' and expires_at >= now()))
       and scheduled_at < v_end
       and scheduled_at + make_interval(mins => v_trial_mins) > p_scheduled_at
  ) ocupants;

  if v_exclusiva > 0 then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  if v_ocupades >= p_capacity then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  -- El CLIENT tampoc pot ser a dos llocs alhora (0105): cap altra reserva
  -- viva seva que es trepitgi amb aquesta, sigui amb qui sigui. Abans que el
  -- bo: si no hi cap, no es toca cap sessió. La constraint
  -- `reservations_no_client_overlap` fa de xarxa si dues peticions seves
  -- arriben alhora per a dos professionals (panys diferents).
  if exists (
    select 1
      from public.reservations
     where client_id = p_client_id
       and status = 'booked'
       and scheduled_at < v_end
       and ends_at > p_scheduled_at
  ) then
    return jsonb_build_object('ok', false, 'reason', 'client_overlap');
  end if;

  -- NOMÉS si hi ha bo. Sense bo és una sessió de cortesia.
  if p_bono_id is not null then
    -- La segona barrera (0103, obligatòria des de la 0104): la fila, bloquejada fins al final, i la regla
    -- de l'aplicació sencera abans de tocar-la.
    -- Sense valor per defecte (0104) ja no es pot OMETRE, però es podria passar
    -- null a posta: amb bo, això també s'atura. La cortesia no en necessita.
    if p_today is null then
      raise exception '%: cal p_today (el dia del centre) per reservar amb bo.', 'book_group_slot';
    end if;
    select * into v_bono from public.bonos where id = p_bono_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'bono_not_found');
    end if;
    if v_bono.client_id <> p_client_id then
      return jsonb_build_object('ok', false, 'reason', 'bono_other_client');
    end if;
    if v_bono.service_type <> 'grupo_reducido' then
      return jsonb_build_object('ok', false, 'reason', 'bono_other_service');
    end if;
    if v_bono.status not in ('active', 'pending_payment') then
      return jsonb_build_object('ok', false, 'reason', 'bono_not_usable');
    end if;
    if v_bono.expires_at is not null and v_bono.expires_at < p_today then
      return jsonb_build_object('ok', false, 'reason', 'bono_expired', 'expires_at', v_bono.expires_at);
    end if;
    if v_bono.remaining_sessions <= 0 or v_bono.remaining_sessions <> p_expected_remaining then
      return jsonb_build_object('ok', false, 'reason', 'no_sessions');
    end if;

    -- El descompte de sempre. Les condicions de la 0083 s'hi queden: amb la
    -- fila bloquejada ja no poden fallar, però no costen res.
    update public.bonos
       set remaining_sessions = remaining_sessions - 1,
           status = case
                      when remaining_sessions - 1 = 0 and status = 'active'
                        then 'completed'::public.bono_status
                      else status
                    end,
           first_reservation_at = coalesce(first_reservation_at, now())
     where id = p_bono_id
       and remaining_sessions = p_expected_remaining
       and remaining_sessions > 0
    returning * into v_bono;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'no_sessions');
    end if;

    v_remaining := v_bono.remaining_sessions;
  end if;

  insert into public.reservations
    (client_id, bono_id, trainer_id, scheduled_at, duration_minutes,
     service_type, status, is_complimentary)
  values
    (p_client_id, p_bono_id, p_trainer_id, p_scheduled_at, p_duration_minutes,
     'grupo_reducido', 'booked', p_bono_id is null)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', v_remaining);
end;
$$;

comment on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) is
  'Reserva una plaça de grup serialitzant per professional (advisory lock) i comptant l''aforament per solapament. Amb bo, comprova a la base que sigui del client, de grup, active o pending_payment, no caducat respecte a p_today (el dia del centre, obligatori des de la 0104) i amb les sessions esperades, amb la fila bloquejada (0103). Amb p_bono_id null és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|full|client_overlap|no_sessions|bono_not_found|bono_other_client|bono_other_service|bono_not_usable|bono_expired}.';

revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from public;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from anon;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from authenticated;
grant execute on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) to service_role;

-- ─── 3. book_individual_slot ────────────────────────────────────────────────

create or replace function public.book_individual_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_service_type       public.service_type,
  p_duration_minutes   integer,
  -- Com a book_group_slot: el dia del centre per a la caducitat, obligatori.
  p_today              date
)
returns jsonb
language plpgsql
as $$
declare
  v_ocupades   integer;
  v_bono       public.bonos%rowtype;
  v_id         uuid;
  v_remaining  integer;
  v_end        timestamptz;
  v_trial_mins constant integer := 60;
begin
  if p_service_type = 'grupo_reducido' then
    raise exception
      'book_individual_slot: grupo_reducido va per book_group_slot, que és qui compta l''aforament.';
  end if;

  v_end := p_scheduled_at + make_interval(mins => p_duration_minutes);

  if p_trainer_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_trainer_id::text, 0));

    select count(*)
      into v_ocupades
      from (
        select 1
          from public.reservations
         where trainer_id = p_trainer_id
           and status = 'booked'
           and scheduled_at < v_end
           and ends_at > p_scheduled_at
        union all
        select 1
          from public.trial_bookings
         where trainer_id = p_trainer_id
           and (status = 'confirmed' or (status = 'pending' and expires_at >= now()))
           and scheduled_at < v_end
           and scheduled_at + make_interval(mins => v_trial_mins) > p_scheduled_at
      ) ocupants;

    if v_ocupades > 0 then
      return jsonb_build_object('ok', false, 'reason', 'taken');
    end if;
  end if;

  -- El CLIENT tampoc pot ser a dos llocs alhora (0105): cap altra reserva
  -- viva seva que es trepitgi amb aquesta, sigui amb qui sigui. Abans que el
  -- bo: si no hi cap, no es toca cap sessió. La constraint
  -- `reservations_no_client_overlap` fa de xarxa si dues peticions seves
  -- arriben alhora per a dos professionals (panys diferents).
  if exists (
    select 1
      from public.reservations
     where client_id = p_client_id
       and status = 'booked'
       and scheduled_at < v_end
       and ends_at > p_scheduled_at
  ) then
    return jsonb_build_object('ok', false, 'reason', 'client_overlap');
  end if;

  if p_bono_id is not null then
    -- La segona barrera (0103, obligatòria des de la 0104), la mateixa que a book_group_slot. El servei
    -- ha de ser el que es reserva: un bo de fisio no paga una EP.
    -- Sense valor per defecte (0104) ja no es pot OMETRE, però es podria passar
    -- null a posta: amb bo, això també s'atura. La cortesia no en necessita.
    if p_today is null then
      raise exception '%: cal p_today (el dia del centre) per reservar amb bo.', 'book_individual_slot';
    end if;
    select * into v_bono from public.bonos where id = p_bono_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'bono_not_found');
    end if;
    if v_bono.client_id <> p_client_id then
      return jsonb_build_object('ok', false, 'reason', 'bono_other_client');
    end if;
    if v_bono.service_type <> p_service_type then
      return jsonb_build_object('ok', false, 'reason', 'bono_other_service');
    end if;
    if v_bono.status not in ('active', 'pending_payment') then
      return jsonb_build_object('ok', false, 'reason', 'bono_not_usable');
    end if;
    if v_bono.expires_at is not null and v_bono.expires_at < p_today then
      return jsonb_build_object('ok', false, 'reason', 'bono_expired', 'expires_at', v_bono.expires_at);
    end if;
    if v_bono.remaining_sessions <= 0 or v_bono.remaining_sessions <> p_expected_remaining then
      return jsonb_build_object('ok', false, 'reason', 'no_sessions');
    end if;

    update public.bonos
       set remaining_sessions = remaining_sessions - 1,
           status = case
                      when remaining_sessions - 1 = 0 and status = 'active'
                        then 'completed'::public.bono_status
                      else status
                    end,
           first_reservation_at = coalesce(first_reservation_at, now())
     where id = p_bono_id
       and remaining_sessions = p_expected_remaining
       and remaining_sessions > 0
    returning * into v_bono;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'no_sessions');
    end if;

    v_remaining := v_bono.remaining_sessions;
  end if;

  insert into public.reservations
    (client_id, bono_id, trainer_id, scheduled_at, duration_minutes,
     service_type, status, is_complimentary)
  values
    (p_client_id, p_bono_id, p_trainer_id, p_scheduled_at, p_duration_minutes,
     p_service_type, 'booked', p_bono_id is null)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', v_remaining);
end;
$$;

comment on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) is
  'Reserva una sessió que no és de grup amb el MATEIX advisory lock que book_group_slot. Amb bo, comprova a la base que sigui del client, del mateix servei, active o pending_payment, no caducat respecte a p_today (el dia del centre, obligatori des de la 0104) i amb les sessions esperades, amb la fila bloquejada (0103). Amb p_bono_id null és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|client_overlap|no_sessions|bono_not_found|bono_other_client|bono_other_service|bono_not_usable|bono_expired}.';

revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from public;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from anon;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from authenticated;
grant execute on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) to service_role;

-- ─── 4. reschedule_reservation ──────────────────────────────────────────────

create or replace function public.reschedule_reservation(
  p_id           uuid,
  p_scheduled_at timestamptz,
  p_capacity     integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r            public.reservations%rowtype;
  v_end        timestamptz;
  v_ocupades   integer;
  v_exclusiva  integer;
  -- Igual que a la 0083 i la 0084: una prova no porta durada pròpia.
  v_trial_mins constant integer := 60;
begin
  -- La fila, bloquejada fins al final: ningú no la pot cancel·lar ni moure
  -- mentre es comprova on va.
  select * into r from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if r.status <> 'booked' then
    return jsonb_build_object('ok', false, 'reason', 'not_booked');
  end if;
  if p_scheduled_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'past');
  end if;
  if p_scheduled_at = r.scheduled_at then
    return jsonb_build_object('ok', false, 'reason', 'same');
  end if;

  v_end := p_scheduled_at + make_interval(mins => r.duration_minutes);

  if r.trainer_id is not null then
    -- El MATEIX pany que book_group_slot i book_individual_slot: les tres
    -- s'han de veure entre elles.
    perform pg_advisory_xact_lock(hashtextextended(r.trainer_id::text, 0));

    -- Qui ocupa la franja nova, per solapament, SENSE comptar-hi la reserva
    -- que es mou.
    select count(*),
           count(*) filter (where o.exclusiva)
      into v_ocupades, v_exclusiva
      from (
        select service_type <> 'grupo_reducido' as exclusiva
          from public.reservations
         where trainer_id = r.trainer_id
           and status = 'booked'
           and id <> r.id
           and scheduled_at < v_end
           and ends_at > p_scheduled_at
        union all
        select true
          from public.trial_bookings
         where trainer_id = r.trainer_id
           and (status = 'confirmed' or (status = 'pending' and expires_at >= now()))
           and scheduled_at < v_end
           and scheduled_at + make_interval(mins => v_trial_mins) > p_scheduled_at
      ) o;

    if r.service_type = 'grupo_reducido' then
      -- Una plaça de grup: cap exclusiva a la franja i menys de l'aforament.
      if v_exclusiva > 0 then
        return jsonb_build_object('ok', false, 'reason', 'taken');
      end if;
      if v_ocupades >= p_capacity then
        return jsonb_build_object('ok', false, 'reason', 'full');
      end if;
    elsif v_ocupades > 0 then
      -- Una individual: ningú més a la franja, tampoc un grup amb places.
      return jsonb_build_object('ok', false, 'reason', 'taken');
    end if;
  end if;

  -- El client tampoc pot quedar a dos llocs alhora (0105): cap altra reserva
  -- viva SEVA a l'hora nova, sense comptar la que es mou.
  if exists (
    select 1
      from public.reservations
     where client_id = r.client_id
       and status = 'booked'
       and id <> r.id
       and scheduled_at < v_end
       and ends_at > p_scheduled_at
  ) then
    return jsonb_build_object('ok', false, 'reason', 'client_overlap');
  end if;

  update public.reservations
     set scheduled_at = p_scheduled_at
   where id = r.id;

  -- Si l'UPDATE peta —per exemple, la constraint de la 0082 o la de la 0105
  -- hi troben un solapament que els recomptes no han vist— l'excepció tomba la transacció i la
  -- reserva es queda on era.
  return jsonb_build_object(
    'ok', true,
    'id', r.id,
    'client_id', r.client_id,
    'trainer_id', r.trainer_id,
    'service_type', r.service_type,
    'old_scheduled_at', r.scheduled_at,
    'scheduled_at', p_scheduled_at
  );
end;
$$;

revoke all on function public.reschedule_reservation(uuid, timestamptz, integer) from public;
revoke all on function public.reschedule_reservation(uuid, timestamptz, integer) from anon;
revoke all on function public.reschedule_reservation(uuid, timestamptz, integer) from authenticated;
grant execute on function public.reschedule_reservation(uuid, timestamptz, integer) to service_role;

comment on function public.reschedule_reservation(uuid, timestamptz, integer) is
  'Mou una reserva viva a una altra hora sense tocar el bo ni la sèrie. Serialitza per professional amb el mateix advisory lock que book_group_slot/book_individual_slot i compta els ocupants (reserves i proves) per solapament excloent-hi la mateixa reserva. Retorna {ok:true,id,client_id,trainer_id,service_type,old_scheduled_at,scheduled_at} o {ok:false,reason:not_found|not_booked|past|same|taken|full|client_overlap}. El permís, la disponibilitat i la llista d''espera de l''hora antiga els fa l''aplicació.';

commit;

-- Que PostgREST vegi els comentaris i els motius nous.
notify pgrst, 'reload schema';
