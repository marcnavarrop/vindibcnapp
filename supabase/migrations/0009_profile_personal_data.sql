-- ============================================================================
-- VindiBCN · 0009 — Dades personals del perfil
--
-- Camps opcionals per a la fitxa del client: data de naixement, alçada, pes,
-- gènere, contacte d'emergència i objectiu. Tots nullable.
-- ============================================================================
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists height_cm int
    check (height_cm is null or height_cm between 50 and 260),
  add column if not exists weight_kg numeric(5, 2)
    check (weight_kg is null or weight_kg between 20 and 400),
  add column if not exists gender text
    check (gender is null or gender in ('home', 'dona', 'altre', 'ns_nc')),
  add column if not exists emergency_contact text,
  add column if not exists objective text;
