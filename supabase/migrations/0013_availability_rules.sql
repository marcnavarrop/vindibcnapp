-- ============================================================================
-- VindiBCN · 0013 — Disponibilitat horària dels entrenadors/fisios
--
-- Regles setmanals: per a un dia de la setmana (0=dilluns … 6=diumenge) i una
-- franja horària, vàlides des d'una data i opcionalment fins a una altra.
-- ============================================================================
create table public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.profiles (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  valid_from  date not null default current_date,
  valid_until date,
  created_at  timestamptz not null default now()
);

create index idx_availability_trainer on public.availability_rules (trainer_id);

alter table public.availability_rules enable row level security;

-- SELECT: qualsevol usuari autenticat (són horaris d'obertura, no sensibles).
create policy "availability_select" on public.availability_rules
  for select using (auth.uid() is not null);

-- INSERT/UPDATE/DELETE: admin o el propi entrenador.
create policy "availability_write" on public.availability_rules
  for all
  using (public.is_admin() or trainer_id = auth.uid())
  with check (public.is_admin() or trainer_id = auth.uid());
