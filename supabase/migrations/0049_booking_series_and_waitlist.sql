-- ============================================================================
-- VindiBCN · 0049 — Reserva en bucle (sèries) i llista d'espera
--
-- Dues peces que van juntes:
--   1) Una SÈRIE agrupa les reserves creades d'un cop per l'assistent de
--      "reserva en bucle" (cada dimarts a les 18 h fins al desembre, posem).
--      Amb `reservations.series_id` es poden cancel·lar totes de cop.
--   2) La LLISTA D'ESPERA recull els forats que la sèrie no ha pogut reservar
--      perquè estaven plens. Quan algú cancel·la, el primer de la cua entra.
--
-- La llista d'espera no existia de cap manera fins ara: és sistema nou.
-- ============================================================================

-- ─── A quina sèrie pertany una reserva ──────────────────────────────────────
-- Sense FK a `booking_series` amb `on delete cascade`: esborrar la sèrie no ha
-- d'esborrar reserves que la gent ja té a l'agenda. Es posa a null i les
-- reserves segueixen existint pel seu compte.
alter table public.reservations
  add column if not exists series_id uuid;

comment on column public.reservations.series_id is
  'Sèrie que va crear aquesta reserva. Null = reserva solta.';

create index if not exists reservations_series_idx
  on public.reservations (series_id) where series_id is not null;

-- ─── Freqüència ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_frequency') then
    create type public.booking_frequency as enum ('weekly', 'biweekly', 'monthly');
  end if;
end
$$;

-- ─── La sèrie ───────────────────────────────────────────────────────────────
create table if not exists public.booking_series (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  -- El bo del qual surten les sessions. Si el bo desapareix, la sèrie perd el
  -- sentit però les reserves ja creades es queden (les governa el seu propi bo).
  bono_id           uuid references public.bonos (id) on delete set null,
  service_type      public.service_type not null,
  -- Professional de la sessió inicial: el punt de partida del patró.
  base_trainer_id   uuid references public.profiles (id) on delete set null,
  frequency         public.booking_frequency not null,

  -- Fins quan es repeteix. Es pot dir amb una data, amb un nombre de sessions
  -- o amb totes dues; el que mana és el que arribi ABANS.
  end_date          date,
  occurrence_count  integer check (occurrence_count is null or occurrence_count > 0),

  -- Els tres interruptors de l'assistent.
  book_only_available boolean not null default false,
  allow_alternatives  boolean not null default true,
  allow_waitlist      boolean not null default false,

  created_at        timestamptz not null default now(),

  -- Una sèrie sense final és una sèrie infinita: cal dir com s'atura.
  constraint booking_series_needs_an_end
    check (end_date is not null or occurrence_count is not null)
);

comment on table public.booking_series is
  'Sèries de reserves creades per l''assistent de reserva en bucle.';
comment on column public.booking_series.end_date is
  'Data límit. Si també hi ha occurrence_count, mana el primer dels dos que es compleixi.';
comment on column public.booking_series.book_only_available is
  'Només confirma el que estigui lliure: té PRIORITAT sobre alternatives i llista d''espera.';

create index if not exists booking_series_client_idx
  on public.booking_series (client_id, created_at desc);

-- ─── Llista d'espera ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'waitlist_status') then
    create type public.waitlist_status as enum (
      'waiting',    -- a la cua
      'fulfilled',  -- s'ha alliberat una plaça i ja té la reserva
      'expired',    -- va passar el dia sense que s'alliberés res
      'cancelled'   -- se n'ha desapuntat
    );
  end if;
end
$$;

create table if not exists public.waitlist_entries (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  bono_id       uuid references public.bonos (id) on delete set null,
  service_type  public.service_type not null,
  -- Null = qualsevol professional. Avui l'assistent sempre el desa, però la
  -- columna admet l'espera oberta sense haver de tocar la taula.
  trainer_id    uuid references public.profiles (id) on delete cascade,

  -- El moment desitjat, en hora del CENTRE. Es desa partit en data i hora
  -- perquè és com es demana ("dimarts a les 18") i com es compara amb les
  -- franges; l'instant exacte es reconstrueix amb la zona del centre.
  desired_date  date not null,
  desired_time  time not null,

  series_id     uuid references public.booking_series (id) on delete set null,

  status        public.waitlist_status not null default 'waiting',
  created_at    timestamptz not null default now(),
  fulfilled_at  timestamptz,
  fulfilled_reservation_id uuid references public.reservations (id) on delete set null,

  -- Una entrada complerta ha de dir quan i amb quina reserva.
  constraint waitlist_fulfilled_complete check (
    status <> 'fulfilled'
    or (fulfilled_at is not null and fulfilled_reservation_id is not null)
  )
);

comment on table public.waitlist_entries is
  'Cua d''espera per a franges plenes. En cancel·lar-se una reserva, entra la més antiga.';

-- L'índex que fa servir la promoció: busca per franja exacta i ordena per
-- antiguitat. Amb el `where` només indexa les que estan realment a la cua.
create index if not exists waitlist_waiting_slot_idx
  on public.waitlist_entries (desired_date, desired_time, trainer_id, service_type, created_at)
  where status = 'waiting';

create index if not exists waitlist_client_idx
  on public.waitlist_entries (client_id, created_at desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Mateix patró que la resta del projecte: el client veu i gestiona el seu,
-- l'admin ho veu tot. Les escriptures de debò les fa el servidor amb el client
-- de servei després de validar; això és la segona barrera.

alter table public.booking_series enable row level security;

drop policy if exists "booking_series_select" on public.booking_series;
create policy "booking_series_select" on public.booking_series
  for select to authenticated
  using (public.is_admin() or public.owns_client(client_id));

drop policy if exists "booking_series_insert" on public.booking_series;
create policy "booking_series_insert" on public.booking_series
  for insert to authenticated
  with check (public.is_admin() or public.owns_client(client_id));

drop policy if exists "booking_series_update" on public.booking_series;
create policy "booking_series_update" on public.booking_series
  for update to authenticated
  using (public.is_admin() or public.owns_client(client_id))
  with check (public.is_admin() or public.owns_client(client_id));

drop policy if exists "booking_series_delete" on public.booking_series;
create policy "booking_series_delete" on public.booking_series
  for delete to authenticated
  using (public.is_admin() or public.owns_client(client_id));

alter table public.waitlist_entries enable row level security;

drop policy if exists "waitlist_select" on public.waitlist_entries;
create policy "waitlist_select" on public.waitlist_entries
  for select to authenticated
  using (public.is_admin() or public.owns_client(client_id));

drop policy if exists "waitlist_insert" on public.waitlist_entries;
create policy "waitlist_insert" on public.waitlist_entries
  for insert to authenticated
  with check (public.is_admin() or public.owns_client(client_id));

-- El client pot desapuntar-se; passar una entrada a 'fulfilled' ho fa el
-- servidor amb el client de servei, mai el navegador.
drop policy if exists "waitlist_update" on public.waitlist_entries;
create policy "waitlist_update" on public.waitlist_entries
  for update to authenticated
  using (public.is_admin() or public.owns_client(client_id))
  with check (public.is_admin() or public.owns_client(client_id));

drop policy if exists "waitlist_delete" on public.waitlist_entries;
create policy "waitlist_delete" on public.waitlist_entries
  for delete to authenticated
  using (public.is_admin() or public.owns_client(client_id));

-- ─── Avís quan entres des de la llista d'espera ─────────────────────────────
-- Actiu per defecte: se t'acaba de crear una reserva sense que la demanessis
-- en aquell moment; assabentar-se'n no és opcional.
alter table public.notification_preferences
  add column if not exists waitlist_fulfilled_email    boolean not null default true,
  add column if not exists waitlist_fulfilled_whatsapp boolean not null default false;
