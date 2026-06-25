-- ============================================================================
-- VindiBCN · 0008 — Idioma preferido del perfil
--
-- Guarda la preferencia de idioma del usuario (ca | es | en). De momento NO
-- traduce la interfaz: solo persiste la elección para usarla más adelante.
-- ============================================================================
alter table public.profiles
  add column if not exists preferred_language text not null default 'ca'
  check (preferred_language in ('ca', 'es', 'en'));

comment on column public.profiles.preferred_language is
  'Idioma preferit de la interfície: ca | es | en. Default ca.';
