-- ============================================================================
-- VindiBCN · 0015 — Registre d'accions sobre dades personals (RGPD)
--
-- Deixa constància de quan un admin exporta o elimina les dades d'un client,
-- per poder demostrar que s'ha atès una sol·licitud de drets (accés,
-- portabilitat, supressió). subject_profile_id NO té FK a propòsit: el registre
-- ha de sobreviure encara que s'elimini el client.
-- ============================================================================
create table public.data_access_log (
  id                 uuid primary key default gen_random_uuid(),
  actor_id           uuid references public.profiles (id) on delete set null,
  subject_profile_id uuid,
  subject_label      text,
  action             text not null check (action in ('export', 'delete')),
  details            text,
  created_at         timestamptz not null default now()
);

create index idx_data_access_log_subject
  on public.data_access_log (subject_profile_id);

alter table public.data_access_log enable row level security;

-- Només l'admin pot llegir/escriure el registre.
create policy "data_access_log_select" on public.data_access_log
  for select using (public.is_admin());

create policy "data_access_log_insert" on public.data_access_log
  for insert with check (public.is_admin());
