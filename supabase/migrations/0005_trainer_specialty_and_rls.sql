-- ============================================================================
-- VindiBCN · 0005 — Especialidad de entrenador + RLS de coordinación
--
-- 1. Columna `specialty` en profiles (entrenador / fisioterapeuta).
-- 2. Helper is_trainer() y apertura del SELECT de clients/bonos/reservations
--    a CUALQUIER entrenador (para coordinarse entre entrenador y fisio),
--    manteniendo la escritura limitada a admin o al entrenador asignado.
-- 3. payments NO se toca: sigue siendo admin + el propio cliente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Especialidad del entrenador
--    Solo tiene sentido cuando role = 'trainer'; nullable para el resto.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists specialty text
  check (specialty is null or specialty in ('entrenador', 'fisioterapeuta'));

comment on column public.profiles.specialty is
  'Especialidad del entrenador: entrenador | fisioterapeuta. NULL si no aplica.';

-- ----------------------------------------------------------------------------
-- 2. Helper: ¿el usuario actual es entrenador?
--    SECURITY DEFINER + search_path fijo → lee profiles sin disparar la RLS
--    de profiles (igual que is_admin()), por lo que no hay recursión.
-- ----------------------------------------------------------------------------
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'trainer'
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS — SELECT abierto a cualquier entrenador
-- ----------------------------------------------------------------------------

-- ---- clients --------------------------------------------------------------
-- SELECT: admin, el propio cliente, su entrenador asignado, o cualquier trainer.
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients
  for select using (
    public.is_admin()
    or profile_id = auth.uid()
    or assigned_trainer_id = auth.uid()
    or public.is_trainer()
  );

-- ESCRITURA: el admin (cualquiera) + el entrenador asignado (sus clientes).
-- La policy de admin existente (clients_admin_write, FOR ALL) se mantiene;
-- añadimos la del entrenador asignado para UPDATE (p. ej. notas).
drop policy if exists "clients_trainer_update" on public.clients;
create policy "clients_trainer_update" on public.clients
  for update using (public.is_trainer_of(id))
  with check (public.is_trainer_of(id));

-- ---- bonos ----------------------------------------------------------------
-- SELECT abierto a cualquier trainer (coordinación).
drop policy if exists "bonos_select" on public.bonos;
create policy "bonos_select" on public.bonos
  for select using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
    or public.is_trainer()
  );

-- INSERT/UPDATE/DELETE: admin (policy existente) o el entrenador asignado.
drop policy if exists "bonos_trainer_write" on public.bonos;
create policy "bonos_trainer_write" on public.bonos
  for all using (public.is_trainer_of(client_id))
  with check (public.is_trainer_of(client_id));

-- ---- reservations ---------------------------------------------------------
-- SELECT abierto a cualquier trainer (coordinación).
drop policy if exists "reservations_select" on public.reservations;
create policy "reservations_select" on public.reservations
  for select using (
    public.is_admin()
    or trainer_id = auth.uid()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
    or public.is_trainer()
  );

-- INSERT/UPDATE/DELETE: admin (policy existente) o el entrenador asignado.
drop policy if exists "reservations_trainer_write" on public.reservations;
create policy "reservations_trainer_write" on public.reservations
  for all using (public.is_trainer_of(client_id))
  with check (public.is_trainer_of(client_id));

-- payments: sin cambios (admin + cliente propietario).
