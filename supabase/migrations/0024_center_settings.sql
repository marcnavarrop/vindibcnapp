-- Configuració global del centre (taula singleton: sempre hi ha exactament 1 fila).
-- Patró singleton: id boolean PK amb check(id) permet un sol valor possible (true).

create table public.center_settings (
  id       boolean primary key default true not null,
  constraint center_settings_one_row check (id),
  min_cancellation_hours integer not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insereix la fila inicial amb els valors per defecte.
insert into public.center_settings default values;

-- RLS
alter table public.center_settings enable row level security;

-- Qualsevol usuari autenticat pot llegir la configuració (per validar al client).
create policy "authenticated read center_settings"
  on public.center_settings for select
  to authenticated
  using (true);

-- Només admins poden actualitzar.
create policy "admin update center_settings"
  on public.center_settings for update
  to authenticated
  using (is_admin())
  with check (is_admin());
