-- ============================================================================
-- VindiBCN · 0012 — Exercicis assignats a un client
--
-- Relaciona un client amb exercicis de la biblioteca, amb notes de
-- l'entrenador/a (p. ex. "3 sèries de 12, dos cops/setmana").
-- ============================================================================
create table public.client_exercises (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  notes        text,
  assigned_at  timestamptz not null default now()
);

create index idx_client_exercises_client on public.client_exercises (client_id);

alter table public.client_exercises enable row level security;

-- SELECT: admin, el propi client, o el seu entrenador/a assignat.
create policy "client_exercises_select" on public.client_exercises
  for select using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

-- INSERT/UPDATE/DELETE: admin o l'entrenador/a assignat. El client mai escriu.
create policy "client_exercises_write" on public.client_exercises
  for all
  using (public.is_admin() or public.is_trainer_of(client_id))
  with check (public.is_admin() or public.is_trainer_of(client_id));
