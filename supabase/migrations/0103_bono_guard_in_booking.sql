-- ============================================================================
-- VindiBCN · 0103 — La base també comprova el bo abans de gastar-ne una sessió
--
-- EL PENDENT QUE TANCA
--
-- `book_group_slot` (0083) i `book_individual_slot` (0084) descompten una
-- sessió amb un bloqueig optimista (`remaining_sessions = p_expected_remaining`)
-- però no miren de QUI és el bo, de QUIN servei, en QUIN estat està ni si ha
-- CADUCAT. Confien que l'aplicació ho hagi mirat abans, i avui ho fa a tots els
-- camins (vegeu docs/ARQUITECTURA.md, «Pendent: la base no torna a comprovar el
-- bo en reservar»). Aquesta migració hi posa la segona barrera: un camí nou que
-- se n'oblidi no podrà gastar una sessió d'un bo que no toca.
--
-- LA REGLA ÉS LA DE L'APLICACIÓ, NI MÉS NI MENYS
--
-- La mateixa que `assertBonoUsable` i `isBonoExpired` (lib/data/bonos.ts,
-- lib/data/reservations.ts), els filtres de `createClientReservation`, de la
-- llista d'espera i de les sèries, i la que ja fa servir `claim_subscription_extra`
-- (0073):
--
--   · el bo és del client de la reserva;
--   · és del servei que es reserva (el grup, 'grupo_reducido');
--   · està 'active' o 'pending_payment' (un bo pendent de cobrar ES POT fer
--     servir: és la decisió de sempre del centre);
--   · no ha caducat: sense data no caduca, i amb data ha de ser D'AVUI o
--     posterior, on «avui» és el dia del CENTRE;
--   · li queda alguna sessió, i en té les que qui crida va llegir.
--
-- EL DIA DEL CENTRE ARRIBA DE FORA (`p_today`)
--
-- Com a la 0073: no es calcula aquí. La zona és configurable per variable
-- d'entorn (CENTER_TIMEZONE) i un `now() at time zone 'Europe/Madrid'` clavat
-- al DDL seria una segona veritat. L'aplicació passa `centerToday()`, el MATEIX
-- valor amb què acaba de triar el bo, així que a la mitjanit no hi pot haver un
-- bo que l'aplicació dona per bo i la base per caducat.
--
-- `p_today` té valor per defecte NULL perquè l'ordre entre aplicar la migració
-- i desplegar el codi no sigui delicat: amb NULL es comprova tot menys la
-- caducitat, que és exactament el que l'aplicació d'ara ja fa abans de cridar.
-- El codi nou sempre la passa. (Si un dia es vol obligatòria, és treure el
-- `default` en una migració pròpia.)
--
-- LA FILA DEL BO, BLOQUEJADA (`for update`)
--
-- Les comprovacions i el descompte han de veure el MATEIX bo: sense el
-- bloqueig, entre llegir-lo i descomptar-lo algú el podria anul·lar. L'ordre
-- dels panys és sempre el mateix (primer el del professional, després la fila
-- del bo), i cap altre camí agafa la fila d'un bo i després el pany d'un
-- professional, així que no hi ha cicle possible.
--
-- ELS MOTIUS NOUS
--
-- Es retornen com els d'ara, `{ok:false, reason}`, i no amb `raise`: qui crida
-- ja llegeix `reason`, la llista d'espera en depèn per passar al següent
-- candidat, i una excepció es convertiria en «No s'ha pogut crear la reserva».
--
--   bono_not_found      el bo no existeix
--   bono_other_client   el bo és d'un altre client
--   bono_other_service  el bo és d'un altre servei
--   bono_not_usable     estat que no és 'active' ni 'pending_payment'
--   bono_expired        ha caducat (amb `expires_at` a la resposta)
--   no_sessions         sense sessions, o no en té les esperades (com fins ara)
--
-- EL QUE NO CANVIA
--
-- El pany per professional, el recompte per solapament, l'aforament, la
-- cortesia (amb `p_bono_id` null no es mira cap bo), la derivació de
-- `is_complimentary`, els valors de retorn d'èxit, els permisos (només el
-- service_role) i la configuració de seguretat: les dues segueixen sent
-- SECURITY INVOKER i sense `search_path` propi, com a la 0053, la 0070, la 0083
-- i la 0084. Com que la firma guanya un paràmetre, la vella s'elimina abans
-- (si hi fossin totes dues, una crida sense `p_today` seria ambigua) i els
-- `grant` es refan al final.
-- ============================================================================

-- ─── 1. book_group_slot ─────────────────────────────────────────────────────

drop function if exists public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer);

create or replace function public.book_group_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_capacity           integer,
  p_duration_minutes   integer default 60,
  -- El dia del centre (YYYY-MM-DD) per a la caducitat. Null: no es mira
  -- (només mentre el codi d'abans encara crida sense passar-lo).
  p_today              date    default null
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
    -- La segona barrera (0103): la fila, bloquejada fins al final, i la regla
    -- de l'aplicació sencera abans de tocar-la.
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
    if p_today is not null and v_bono.expires_at is not null and v_bono.expires_at < p_today then
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
  'Reserva una plaça de grup serialitzant per professional (advisory lock) i comptant l''aforament per solapament. Amb bo, comprova a la base que sigui del client, de grup, active o pending_payment, no caducat respecte a p_today (el dia del centre) i amb les sessions esperades, amb la fila bloquejada (0103). Amb p_bono_id null és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|full|no_sessions|bono_not_found|bono_other_client|bono_other_service|bono_not_usable|bono_expired}.';

revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from public;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from anon;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) from authenticated;
grant execute on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer, date) to service_role;

-- ─── 2. book_individual_slot ────────────────────────────────────────────────

drop function if exists public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer);

create or replace function public.book_individual_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_service_type       public.service_type,
  p_duration_minutes   integer default 60,
  -- Com a book_group_slot: el dia del centre per a la caducitat.
  p_today              date    default null
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
    -- La segona barrera (0103), la mateixa que a book_group_slot. El servei
    -- ha de ser el que es reserva: un bo de fisio no paga una EP.
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
    if p_today is not null and v_bono.expires_at is not null and v_bono.expires_at < p_today then
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
  'Reserva una sessió que no és de grup amb el MATEIX advisory lock que book_group_slot. Amb bo, comprova a la base que sigui del client, del mateix servei, active o pending_payment, no caducat respecte a p_today (el dia del centre) i amb les sessions esperades, amb la fila bloquejada (0103). Amb p_bono_id null és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|no_sessions|bono_not_found|bono_other_client|bono_other_service|bono_not_usable|bono_expired}.';

revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from public;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from anon;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) from authenticated;
grant execute on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer, date) to service_role;

-- ─── 3. Que PostgREST vegi les firmes noves ─────────────────────────────────
-- Sense això, l'API segueix amb la memòria de les funcions esborrades fins que
-- es refresca sola, i una crida amb `p_today` podria no trobar la nova.
notify pgrst, 'reload schema';
