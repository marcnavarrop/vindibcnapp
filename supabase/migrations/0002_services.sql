-- ============================================================================
-- VindiBCN · Catálogo de servicios y precios
-- Tabla de servicios que el centro ofrece, con su precio y nº de sesiones por
-- defecto. Alimenta el alta de bonos (prerrellena precio/sesiones).
-- ============================================================================

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  service_type     public.service_type not null,
  name             text not null,
  price            numeric(10, 2) not null check (price >= 0),
  default_sessions int not null default 1 check (default_sessions > 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index idx_services_active on public.services (active);

-- ----------------------------------------------------------------------------
-- RLS: cualquier usuario autenticado puede leer el catálogo; solo admin escribe.
-- ----------------------------------------------------------------------------
alter table public.services enable row level security;

create policy "services_select" on public.services
  for select using (auth.uid() is not null);

create policy "services_admin_write" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Servicios iniciales del centro.
-- ----------------------------------------------------------------------------
insert into public.services (service_type, name, price, default_sessions) values
  ('ep_individual',  'Entrenament personal individual', 400, 10),
  ('ep_parejas',     'Entrenament personal en parella', 350, 10),
  ('grupo_reducido', 'Grup reduït',                     200, 8),
  ('fisioterapia',   'Fisioteràpia',                    250, 5);
