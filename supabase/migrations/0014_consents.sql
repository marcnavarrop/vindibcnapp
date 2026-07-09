-- ============================================================================
-- VindiBCN · 0014 — Registre de consentiments (RGPD/LOPDGDD)
--
-- Log append-only de consentiments per poder demostrar QUÈ i QUAN es va
-- consentir (principi de responsabilitat proactiva del RGPD). Cada acceptació
-- és una fila: tipus, versió de la política, moment i IP (si es captura).
--   · 'privacy'      → Política de Privacitat + Avís Legal (a l'alta).
--   · 'health_data'  → tractament de dades de salut (clients de fisioteràpia).
-- ============================================================================
create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('privacy', 'health_data')),
  version    text not null,
  granted_at timestamptz not null default now(),
  ip         text,
  created_at timestamptz not null default now()
);

create index idx_consents_user on public.consents (user_id);

alter table public.consents enable row level security;

-- SELECT: el propi usuari, l'admin, o l'entrenador/a assignat del client.
create policy "consents_select" on public.consents
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.profile_id = consents.user_id
        and c.assigned_trainer_id = auth.uid()
    )
  );

-- INSERT: el propi usuari o l'admin. (A l'alta es registra amb service_role,
-- que salta la RLS perquè l'usuari encara pot no estar autenticat.)
create policy "consents_insert" on public.consents
  for insert with check (public.is_admin() or user_id = auth.uid());
