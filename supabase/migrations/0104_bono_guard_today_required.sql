-- ============================================================================
-- VindiBCN · 0104 — El dia del centre deixa de ser opcional en reservar
--
-- La 0103 va posar la segona barrera del bo dins de `book_group_slot` i
-- `book_individual_slot`, amb `p_today` (el dia del centre) per a la
-- caducitat. Hi duia `default null` NOMÉS per a la transició: amb null es
-- comprovava tot menys la caducitat, i així l'ordre entre aplicar la migració i
-- desplegar el codi no era delicat. El codi que passa `p_today` a les sis crides
-- ja és a producció (665dbba) i reservar s'ha verificat; ara el default se'n va,
-- perquè cap camí futur pugui saltar-se la caducitat.
--
-- QUÈ CANVIA, I PER QUÈ AIXÍ
--
-- 1. `p_today` sense valor per defecte. Postgres no deixa treure un default amb
--    `create or replace` («cannot remove parameter defaults from existing
--    function»): la funció s'esborra i es torna a crear, i els permisos es
--    refan. Tot dins de `begin … commit`, perquè no hi hagi cap instant en què
--    reservar no trobi la funció.
-- 2. `p_duration_minutes` també perd el seu `default 60`: un paràmetre sense
--    default no pot anar després d'un que en té. L'aplicació el passa sempre
--    (SESSION_DURATION_MINUTES, a les sis crides).
-- 3. Sense default ja no es pot OMETRE, però es podria passar `null` a posta.
--    Amb bo, ara això atura la reserva amb una excepció (cortesia, sense bo,
--    no en necessita: no hi ha res a fer caducar).
--
-- EL QUE NO CANVIA
--
-- Tot el cos de la 0103: el pany, el recompte, l'aforament, la regla del bo i
-- els seus motius, la seguretat (SECURITY INVOKER, sense `search_path` propi) i
-- els permisos (només el service_role). La firma de tipus és la mateixa: els
-- `revoke`/`grant` anomenen els mateixos vuit tipus.
-- ============================================================================

begin;

-- ─── 1. book_group_slot ─────────────────────────────────────────────────────

drop function if exists public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date);

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
  'Reserva una plaça de grup serialitzant per professional (advisory lock) i comptant l''aforament per solapament. Amb bo, comprova a la base que sigui del client, de grup, active o pending_payment, no caducat respecte a p_today (el dia del centre, obligatori des de la 0104) i amb les sessions esperades, amb la fila bloquejada (0103). Amb p_bono_id null és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|full|no_sessions|bono_not_found|bono_other_client|bono_other_service|bono_not_usable|bono_expired}.';

revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from public;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from anon;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from authenticated;
grant execute on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) to service_role;

-- ─── 2. book_individual_slot ────────────────────────────────────────────────

drop function if exists public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date);

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
  'Reserva una sessió que no és de grup amb el MATEIX advisory lock que book_group_slot. Amb bo, comprova a la base que sigui del client, del mateix servei, active o pending_payment, no caducat respecte a p_today (el dia del centre, obligatori des de la 0104) i amb les sessions esperades, amb la fila bloquejada (0103). Amb p_bono_id null és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|no_sessions|bono_not_found|bono_other_client|bono_other_service|bono_not_usable|bono_expired}.';

revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from public;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from anon;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from authenticated;
grant execute on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) to service_role;

commit;

-- Que PostgREST vegi les firmes noves (fora de la transacció: el NOTIFY es
-- lliura en fer commit igualment, però així queda clar que va després).
notify pgrst, 'reload schema';
