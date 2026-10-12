-- ============================================================================
-- VindiBCN · 0107 — Qualsevol professional cancel·la una plaça de GRUP, i qui
--                   fa la sessió la pot marcar feta
--
-- Ve del tiquet d'en Raul (8/10): «els clients de grup van canviant d'horari i
-- d'entrenador lliurement». Decisions d'en Marc (12/10):
--
--   (a) Qualsevol professional pot apuntar qualsevol client real a qualsevol
--       grup del centre. (Ho comprova l'app, `assertMayBookFor`: la reserva
--       la fa `book_group_slot` amb la clau de servei.)
--   (b) Sense bo (cortesia), només als seus clients. (També a l'app.)
--   (c) Qualsevol professional pot cancel·lar qualsevol reserva de GRUP.
--       → AQUESTA MIGRACIÓ, part 1.
--
-- I una conseqüència de la segona decisió del mateix dia: el professional pot
-- reservar la SEVA especialitat a qualsevol client real, a la SEVA agenda (el
-- fisio, fisio; l'entrenador, EP). Fins ara marcar una sessió «feta» anava per
-- la RLS `reservations_trainer_write` (0005, `is_trainer_of`): només els
-- clients ASSIGNATS. En Sergi no podria marcar feta una sessió que ell mateix
-- ha donat i reservat. → AQUESTA MIGRACIÓ, part 2.
--
-- PER QUÈ UNA FUNCIÓ I NO AMPLIAR LA RLS
--
-- `reservations_trainer_write` és FOR ALL: obrir-la a `trainer_id = auth.uid()`
-- deixaria el professional canviar QUALSEVOL columna de les reserves de la
-- seva agenda (el client, el bo, l'hora) per l'API, no només l'estat. Una
-- funció que només fa 'booked' → 'completed' obre exactament el que cal, com
-- la 0085 va fer amb cobrar.
--
-- «DEMO AMB DEMO» NO VIU AQUÍ
--
-- La separació dels comptes demo és a l'app (`lib/demo-accounts.ts`): la base
-- no en sap els ids. L'app la torna a mirar abans de cridar aquestes funcions.
-- ============================================================================

-- ─── 1. cancel_reservation: + qualsevol reserva de GRUP ─────────────────────
--
-- Idèntica a la 0091 llevat de la condició del professional. Mateixa
-- signatura, de manera que el `grant` de la 0091 continua valent.

create or replace function public.cancel_reservation(
  p_id    uuid,
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

  select * into v_res from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- El professional: els seus clients assignats (0005), la seva agenda (0091)
  -- i, des de la 0107, qualsevol plaça de grup del centre.
  if public.is_admin() then
    v_actor := 'admin';
  elsif public.is_trainer()
        and (public.is_trainer_of(v_res.client_id)
             or v_res.trainer_id = auth.uid()
             or v_res.service_type = 'grupo_reducido') then
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
  'Cancel·lació normal d''una reserva en una sola transacció (reserva + sessió al bo). Permís a dins: admin tot; professional, els seus clients assignats, qualsevol reserva de la seva agenda i (0107) qualsevol reserva de grup; client, les seves, futures i fora de min_cancellation_hours. Retorna {ok:true, ...} o {ok:false, reason: not_found|forbidden|not_booked|past|too_late}.';

revoke all on function public.cancel_reservation(uuid, date) from public;
revoke all on function public.cancel_reservation(uuid, date) from anon;
grant execute on function public.cancel_reservation(uuid, date) to authenticated;

-- ─── 2. complete_reservation: marcar feta ───────────────────────────────────
--
-- Admin; o professional, si el client és seu (el d'abans, 0005) o si la
-- sessió és de la seva agenda (nou). Només 'booked' → 'completed', res més.
-- La RLS `reservations_trainer_write` no es toca: segueix deixant el que
-- deixava.

create or replace function public.complete_reservation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'complete_reservation: cal una sessió d''usuari.'
      using errcode = '42501';
  end if;

  select * into v_res from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not (
    coalesce(public.is_admin(), false)
    or (coalesce(public.is_trainer(), false)
        and (public.is_trainer_of(v_res.client_id) or v_res.trainer_id = auth.uid()))
  ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if v_res.status <> 'booked' then
    return jsonb_build_object('ok', false, 'reason', 'not_booked');
  end if;

  update public.reservations set status = 'completed' where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.complete_reservation(uuid) is
  'Marca feta una reserva (booked → completed). Admin; professional, si el client és seu o la sessió és de la seva agenda (0107). Retorna {ok:true} o {ok:false, reason: not_found|forbidden|not_booked}.';

revoke all on function public.complete_reservation(uuid) from public;
revoke all on function public.complete_reservation(uuid) from anon;
grant execute on function public.complete_reservation(uuid) to authenticated;
