-- VindiBCN · 0029
-- Substitueix el seguiment de pes corporal (measurements) per càrrega per exercici.

-- ─── DROP measurements ──────────────────────────────────────────────────────
drop table if exists public.measurements cascade;

-- ─── exercise_progress ──────────────────────────────────────────────────────
create table public.exercise_progress (
  id                 uuid primary key default gen_random_uuid(),
  client_exercise_id uuid not null references public.client_exercises(id) on delete cascade,
  recorded_at        date not null default current_date,
  weight_kg          numeric(5,2) not null,
  reps               integer null,
  notes              text null,
  recorded_by        uuid not null references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);

alter table public.exercise_progress enable row level security;

-- Lectura: admin, trainer assignat o propi client
create policy "exercise_progress_select"
  on public.exercise_progress for select
  using (
    public.is_admin()
    or public.owns_client(
      (select c.id from public.clients c
       join public.client_exercises ce on ce.client_id = c.id
       where ce.id = client_exercise_id limit 1)
    )
    or public.is_trainer_of(
      (select c.id from public.clients c
       join public.client_exercises ce on ce.client_id = c.id
       where ce.id = client_exercise_id limit 1)
    )
  );

-- Escriptura: admin o trainer assignat (el client no registra les seves pròpies càrregues)
create policy "exercise_progress_insert"
  on public.exercise_progress for insert
  with check (
    public.is_admin()
    or public.is_trainer_of(
      (select c.id from public.clients c
       join public.client_exercises ce on ce.client_id = c.id
       where ce.id = client_exercise_id limit 1)
    )
  );

create policy "exercise_progress_delete"
  on public.exercise_progress for delete
  using (
    public.is_admin()
    or public.is_trainer_of(
      (select c.id from public.clients c
       join public.client_exercises ce on ce.client_id = c.id
       where ce.id = client_exercise_id limit 1)
    )
  );

-- Índex per consultes freqüents
create index exercise_progress_client_exercise_idx
  on public.exercise_progress (client_exercise_id, recorded_at desc);

-- Nou event type a notification_log (extensió del check constraint si existís,
-- aquí simplement el text ja va sense constraint a la columna).
-- El tipus "new_exercises_assigned" s'afegeix a la capa TypeScript.
