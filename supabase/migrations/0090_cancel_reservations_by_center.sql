-- ============================================================================
-- 0090 · Cancel·lar reserves en nom del centre quan es tanca disponibilitat
-- ============================================================================
--
-- QUÈ RESOL
--
-- Quan un professional tanca disponibilitat (esborra o retalla una franja,
-- n'escurça la vigència o crea un bloqueig), les reserves que hi queien es
-- quedaven 'booked' dins d'un forat que ja no existeix. A partir d'ara la
-- pantalla les llista abans de desar, i les que es marquen es cancel·len aquí.
--
-- PER QUÈ UNA FUNCIÓ I NO EL `cancelReservation` DE SEMPRE
--
-- 1. ATOMICITAT. `cancelReservation` fa dos UPDATE separats (reserva i bo) des
--    de l'aplicació. Si el segon falla, la reserva queda cancel·lada i la
--    sessió no torna: el pitjor estat possible. Aquí les dues coses van en una
--    sola sentència, o sigui en una sola transacció.
--
-- 2. PERMÍS. La RLS d'escriptura del professional sobre `reservations` i
--    `bonos` és `is_trainer_of(client_id)`: només el seu client ASSIGNAT. Però
--    el que tanca un professional és la SEVA agenda, i hi pot tenir clients
--    assignats a un altre. Amb el client de sessió, aquell UPDATE no tocaria cap
--    fila i no donaria cap error. Per això la funció és `security definer` i el
--    permís es mira a dins, amb la regla que toca: l'admin, o el professional
--    sobre les reserves on `trainer_id` és ell.
--
-- 3. IDEMPOTÈNCIA. Només es cancel·len les files que encara són 'booked' i
--    futures, i només es retornen les que ha canviat AQUESTA crida. Repetir-la
--    no torna cap sessió dues vegades, i l'aplicació envia els correus només
--    per a les files retornades: tampoc no n'hi ha de duplicats. Dues crides
--    simultànies amb els mateixos ids es serialitzen pel bloqueig de fila de
--    l'UPDATE, i la segona ja no troba res 'booked'.
--
-- EXCEPCIÓ A LA CONVENCIÓ DE LA CASA
--
-- Les funcions de reserva (0053, 0084) no són `security definer`, les crida
-- només `service_role` i el permís el mira l'aplicació. Aquesta sí que ho és,
-- a posta: el permís depèn de QUI crida (`auth.uid()`), i s'ha de poder cridar
-- amb el client de SESSIÓ. Cridada amb la clau de servei, `auth.uid()` és null
-- i la funció s'hi nega.
--
-- EL DIA DEL CENTRE ARRIBA DE FORA, com a la 0073: la zona és configurable per
-- variable d'entorn i un `now() at time zone 'Europe/Madrid'` aquí seria una
-- segona veritat.
-- ============================================================================

-- ─── 1. Marca de «cancel·lada pel centre» ──────────────────────────────────
--
-- Dues coses en depenen:
--   · L'allargament de sèries (`series-extension.ts`) NO compta aquestes
--     ocurrències per al total de la sèrie: una sèrie de deu en fa deu encara
--     que el centre n'hagi hagut d'anul·lar dues.
--   · El correu al client diu que ha estat el centre.
--
-- Les files d'abans queden a false: no hi ha manera de saber qui les va
-- cancel·lar, i false és el que ja feien (comptar per a la sèrie).

alter table public.reservations
  add column if not exists cancelled_by_center boolean not null default false;

comment on column public.reservations.cancelled_by_center is
  'La reserva la va cancel·lar el centre en tancar disponibilitat (0090), no el client. No compta per al total d''una sèrie i canvia el text del correu.';

-- Coherència: només una reserva cancel·lada pot portar la marca.
alter table public.reservations
  drop constraint if exists reservations_cancelled_by_center_status;
alter table public.reservations
  add constraint reservations_cancelled_by_center_status
  check (not cancelled_by_center or status = 'cancelled');

-- ─── 2. La funció ───────────────────────────────────────────────────────────

create or replace function public.cancel_reservations_by_center(
  p_trainer_id uuid,
  p_ids        uuid[],
  -- El dia del CENTRE, per dir si el bo al qual torna la sessió ja ha caducat.
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
  -- Hi havia bo i s'hi ha tornat la sessió. False = cortesia.
  refunded         boolean,
  -- El bo ja ha caducat: la sessió hi ha tornat, però a la pràctica no es
  -- podrà fer servir. La pantalla i el correu ho diuen sense prometre res.
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

  -- Qui crida. Amb la clau de servei no hi ha usuari i no es fa res: el permís
  -- d'aquesta funció ÉS l'usuari.
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
  with cancelled as (
    -- Els filtres són la frontera del permís i de la idempotència alhora:
    --   · `trainer_id = p_trainer_id`: un id d'una altra agenda s'ignora.
    --   · `status = 'booked'`: una segona crida ja no la troba.
    --   · `scheduled_at > now()`: el passat no es reescriu.
    update public.reservations r
       set status = 'cancelled',
           cancelled_by_center = true
     where r.id = any(p_ids)
       and r.trainer_id = p_trainer_id
       and r.status = 'booked'
       and r.scheduled_at > now()
    returning r.id, r.client_id, r.bono_id, r.trainer_id, r.series_id,
              r.scheduled_at, r.service_type
  ),
  per_bono as (
    -- Un mateix bo pot perdre dues reserves en la mateixa crida (dues setmanes
    -- de vacances): se li tornen totes dues d'un cop.
    select c.bono_id, count(*)::integer as n
      from cancelled c
     where c.bono_id is not null
     group by c.bono_id
  ),
  restored as (
    -- El mateix que fa `restoreBonoSession`: sostre a `total_sessions`, i un bo
    -- 'completed' torna a 'active'. Un bo 'expired' es queda 'expired' (decisió
    -- presa: la sessió hi torna igualment, i es diu que no es podrà usar).
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
  select c.id,
         c.client_id,
         c.bono_id,
         c.trainer_id,
         c.series_id,
         c.scheduled_at,
         c.service_type,
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

comment on function public.cancel_reservations_by_center(uuid, uuid[], date) is
  'Cancel·la, en una sola transacció, les reserves futures ''booked'' d''aquest professional que es passen per p_ids, i en torna la sessió al bo. La pot cridar l''admin, o el professional sobre la seva agenda (trainer_id = auth.uid()), encara que el client estigui assignat a un altre. Idempotent: només retorna les files que ha canviat ella. Marca cancelled_by_center.';

revoke all on function public.cancel_reservations_by_center(uuid, uuid[], date) from public;
revoke all on function public.cancel_reservations_by_center(uuid, uuid[], date) from anon;
grant execute on function public.cancel_reservations_by_center(uuid, uuid[], date) to authenticated;
