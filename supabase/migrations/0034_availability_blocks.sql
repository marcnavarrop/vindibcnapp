-- ============================================================================
-- VindiBCN · 0034 — Bloquejos temporals de disponibilitat
--
-- Capa que se superposa a les regles setmanals (availability_rules) sense
-- modificar-les: vacances, baixes o una tarda puntual. Una franja només és
-- reservable si hi ha regla setmanal I no cau dins de cap bloqueig.
--
-- Es fan servir timestamptz amb hora als dos extrems, de manera que la mateixa
-- taula cobreix tant "de l'1 al 15 d'agost" (de l'obertura del primer dia al
-- tancament del darrer) com "avui de 17:00 a 20:00".
-- ============================================================================
create table if not exists public.availability_blocks (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  reason     text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint availability_blocks_range check (end_at > start_at)
);

-- Les consultes sempre són "bloquejos d'aquest trainer que toquen aquest rang".
create index if not exists idx_availability_blocks_trainer
  on public.availability_blocks (trainer_id, start_at, end_at);

alter table public.availability_blocks enable row level security;

-- SELECT: qualsevol autenticat. Cal per calcular la disponibilitat al calendari.
drop policy if exists "availability_blocks_select" on public.availability_blocks;
create policy "availability_blocks_select" on public.availability_blocks
  for select using (auth.uid() is not null);

-- INSERT/UPDATE/DELETE: admin o el propi entrenador.
drop policy if exists "availability_blocks_write" on public.availability_blocks;
create policy "availability_blocks_write" on public.availability_blocks
  for all
  using (public.is_admin() or trainer_id = auth.uid())
  with check (public.is_admin() or trainer_id = auth.uid());
