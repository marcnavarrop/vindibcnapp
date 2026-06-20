-- ============================================================================
-- VindiBCN · Esquema inicial (Fase 0)
-- Centro de entrenamiento personal / fisioterapia.
-- Incluye: enums, tablas, índices, Row Level Security (RLS),
-- funciones helper y trigger de alta automática de perfil.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensiones
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'trainer', 'client');

create type public.service_type as enum (
  'ep_individual',   -- entrenamiento personal individual
  'ep_parejas',      -- entrenamiento personal en pareja
  'grupo_reducido',  -- grupo reducido
  'fisioterapia'
);

create type public.bono_status as enum ('active', 'completed', 'cancelled');
create type public.reservation_status as enum ('booked', 'completed', 'cancelled');
create type public.payment_method as enum ('card', 'cash');

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

-- profiles: 1:1 con auth.users. Es la "identidad" de cada persona del sistema.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  phone      text,
  role       public.user_role not null default 'client',
  created_at timestamptz not null default now()
);

-- clients: datos del cliente del centro. Un cliente ES un profile con rol 'client'.
create table public.clients (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  assigned_trainer_id uuid references public.profiles (id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (profile_id)
);

-- bonos: paquetes de sesiones comprados por un cliente.
create table public.bonos (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  service_type      public.service_type not null,
  total_sessions    int not null check (total_sessions >= 0),
  remaining_sessions int not null check (remaining_sessions >= 0),
  price             numeric(10, 2) not null check (price >= 0),
  status            public.bono_status not null default 'active',
  purchased_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  check (remaining_sessions <= total_sessions)
);

-- reservations: reservas de sesión, normalmente descontadas de un bono.
create table public.reservations (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  bono_id       uuid references public.bonos (id) on delete set null,
  trainer_id    uuid references public.profiles (id) on delete set null,
  scheduled_at  timestamptz not null,
  service_type  public.service_type not null,
  status        public.reservation_status not null default 'booked',
  created_at    timestamptz not null default now()
);

-- payments: pagos (efectivo o tarjeta vía Stripe en una fase posterior).
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  bono_id           uuid references public.bonos (id) on delete set null,
  stripe_payment_id text,
  amount            numeric(10, 2) not null check (amount >= 0),
  currency          text not null default 'eur',
  method            public.payment_method not null,
  paid_at           timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- Índices para los FKs más consultados.
create index idx_clients_assigned_trainer on public.clients (assigned_trainer_id);
create index idx_bonos_client             on public.bonos (client_id);
create index idx_reservations_client      on public.reservations (client_id);
create index idx_reservations_trainer     on public.reservations (trainer_id);
create index idx_reservations_scheduled   on public.reservations (scheduled_at);
create index idx_payments_client          on public.payments (client_id);

-- ----------------------------------------------------------------------------
-- Funciones helper para RLS
--
-- Son SECURITY DEFINER y leen profiles/clients evitando la recursión infinita
-- que se produciría si una policy de `profiles` consultara `profiles`
-- directamente. `set search_path = public` las protege frente a hijacking.
-- ----------------------------------------------------------------------------

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'admin'
$$;

-- ¿El cliente `cid` pertenece al usuario actual (su propio perfil)?
create or replace function public.owns_client(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid and c.profile_id = auth.uid()
  )
$$;

-- ¿El usuario actual es el entrenador asignado del cliente `cid`?
create or replace function public.is_trainer_of(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid and c.assigned_trainer_id = auth.uid()
  )
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- Regla general:
--   · admin   → ve y gestiona todo
--   · trainer → solo sus clientes asignados y sus reservas
--   · client  → solo sus propios datos
-- ----------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.clients      enable row level security;
alter table public.bonos        enable row level security;
alter table public.reservations enable row level security;
alter table public.payments     enable row level security;

-- ---- profiles -------------------------------------------------------------
-- Cada uno ve su perfil; el admin ve todos; el trainer ve el perfil de sus clientes.
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.profile_id = profiles.id
        and c.assigned_trainer_id = auth.uid()
    )
  );

-- Cada uno edita su propio perfil; el admin edita cualquiera.
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Solo el admin crea/borra perfiles a mano (el alta normal la hace el trigger,
-- que al ser SECURITY DEFINER ignora la RLS).
create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.is_admin());

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- ---- clients --------------------------------------------------------------
create policy "clients_select" on public.clients
  for select using (
    public.is_admin()
    or profile_id = auth.uid()
    or assigned_trainer_id = auth.uid()
  );

create policy "clients_admin_write" on public.clients
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- bonos ----------------------------------------------------------------
create policy "bonos_select" on public.bonos
  for select using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

create policy "bonos_admin_write" on public.bonos
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- reservations ---------------------------------------------------------
create policy "reservations_select" on public.reservations
  for select using (
    public.is_admin()
    or trainer_id = auth.uid()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

create policy "reservations_admin_write" on public.reservations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- payments -------------------------------------------------------------
create policy "payments_select" on public.payments
  for select using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

create policy "payments_admin_write" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Trigger: crear perfil automáticamente al registrarse un usuario en auth.users
--
-- El rol y el nombre se pueden pasar en raw_user_meta_data al hacer signUp:
--   supabase.auth.signUp({ email, password,
--     options: { data: { full_name: 'Ana', role: 'client' } } })
-- Si no se indica rol, por seguridad se asigna 'client'. Los roles admin/trainer
-- se otorgan manualmente desde el panel o la consola de Supabase.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
