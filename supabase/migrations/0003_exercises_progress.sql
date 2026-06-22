-- ============================================================================
-- VindiBCN · Biblioteca de ejercicios + Progreso del cliente
-- (Sin acentos en datos a propósito: el SQL puede pasar por el portapapeles
--  sin problemas de codificación; las etiquetas con acentos van en labels.ts.)
-- ============================================================================

-- ─── Biblioteca de ejercicios ───────────────────────────────────────────────
create type public.exercise_category as enum (
  'forca',         -- fuerza
  'mobilitat',     -- movilidad
  'cardio',
  'rehabilitacio', -- rehabilitacion
  'core'
);

create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    public.exercise_category not null,
  description text,
  video_url   text,
  created_at  timestamptz not null default now()
);

alter table public.exercises enable row level security;

-- Lectura: cualquier usuario autenticado. Escritura: admin o trainer.
create policy "exercises_select" on public.exercises
  for select using (auth.uid() is not null);

create policy "exercises_write" on public.exercises
  for all
  using (public.current_role() in ('admin', 'trainer'))
  with check (public.current_role() in ('admin', 'trainer'));

-- ─── Progreso del cliente (mediciones) ──────────────────────────────────────
create table public.measurements (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  recorded_at date not null default current_date,
  weight_kg   numeric(5, 2),
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_measurements_client on public.measurements (client_id);

alter table public.measurements enable row level security;

-- Lectura: admin, el entrenador del cliente, o el propio cliente.
create policy "measurements_select" on public.measurements
  for select using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

-- Escritura: admin o el entrenador del cliente.
create policy "measurements_write" on public.measurements
  for all
  using (public.is_admin() or public.is_trainer_of(client_id))
  with check (public.is_admin() or public.is_trainer_of(client_id));
