-- ============================================================================
-- VindiBCN · 0093 — Reprogramar una reserva amb les mateixes garanties que
--                   crear-la
--
-- FINS ARA
--
-- Reprogramar era un UPDATE de `scheduled_at` des de l'aplicació. Movia la
-- reserva —no tocava el bo— i era atòmic, però:
--
--   · La constraint de la 0082 només compara sessions que NO són de grup entre
--     elles. Es podia moure una individual a sobre d'un grup, o una plaça de
--     grup a un grup ple.
--   · No mirava les proves actives.
--   · No agafava el pany per professional de la 0083/0084, així que es podia
--     creuar amb una reserva que s'estigués creant alhora.
--
-- QUÈ FA AQUESTA FUNCIÓ
--
-- El moviment, dins del MATEIX pany i amb el MATEIX recompte que
-- `book_group_slot` (0083) i `book_individual_slot` (0084), excloent-hi la
-- reserva que es mou: així la seva hora actual i les contigües compten com a
-- lliures. Només canvia l'hora: el bo, la sèrie i la resta de camps no es
-- toquen, i `ends_at` el recalcula el trigger de la 0082.
--
-- QUÈ SEGUEIX FENT L'APLICACIÓ, I PER QUÈ
--
--   · El permís (`assertMayBookFor`): la funció només la pot cridar el
--     service_role, com les de crear.
--   · La disponibilitat i els bloquejos (`assertWithinAvailability`), igual que
--     en crear.
--   · La llista d'espera de l'hora ANTIGA. Si la plaça que es mou era d'un grup,
--     a l'hora d'abans hi queda lloc; l'aplicació crida `promoteFromWaitlist`
--     DESPRÉS d'aquesta transacció, com fa amb `cancel_reservation` (0091). Per
--     això la funció torna l'hora antiga, el professional i el servei.
-- ============================================================================

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

  update public.reservations
     set scheduled_at = p_scheduled_at
   where id = r.id;

  -- Si l'UPDATE peta —per exemple, la constraint de la 0082 hi troba un
  -- solapament que el recompte no ha vist— l'excepció tomba la transacció i la
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
  'Mou una reserva viva a una altra hora sense tocar el bo ni la sèrie. Serialitza per professional amb el mateix advisory lock que book_group_slot/book_individual_slot i compta els ocupants (reserves i proves) per solapament excloent-hi la mateixa reserva. Retorna {ok:true,id,client_id,trainer_id,service_type,old_scheduled_at,scheduled_at} o {ok:false,reason:not_found|not_booked|past|same|taken|full}. El permís, la disponibilitat i la llista d''espera de l''hora antiga els fa l''aplicació.';
