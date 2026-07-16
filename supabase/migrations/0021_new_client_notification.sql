-- ============================================================================
-- VindiBCN · 0021 — Avís de nou client registrat
--
-- Quan algú es dóna d'alta pel seu compte a /register, l'admin rep un avís.
-- Preferència a notification_preferences (email per defecte true per a l'admin;
-- WhatsApp false). El nom segueix la convenció ${event}_${canal}.
-- ============================================================================
alter table public.notification_preferences
  add column if not exists new_client_registered_email    boolean not null default true,
  add column if not exists new_client_registered_whatsapp boolean not null default false;

-- Les files existents agafen els defaults automàticament (no cal backfill).
