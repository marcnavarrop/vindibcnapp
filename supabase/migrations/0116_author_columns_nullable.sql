-- ============================================================================
-- VindiBCN · 0116 — Progrés i documents: l'autor pot quedar buit en una baixa
--
-- EL PROBLEMA
--
-- `exercise_progress.recorded_by` (0029) i `client_documents.uploaded_by` (0025)
-- són NOT NULL i, alhora, `on delete set null` cap a `profiles`. Les dues coses
-- no poden ser veritat: quan s'esborra el perfil de qui va registrar o pujar
-- alguna cosa, Postgres intenta posar-hi NULL i la columna no ho admet. L'esborrat
-- del perfil FALLA (23502).
--
--   · Progrés: el registra l'equip (admin o professional). No es pot donar de
--     baixa ningú que hagi apuntat mai una càrrega a un client.
--   · Documents: només els puja el client (la política d'alta demana
--     `owns_client`), i cauen amb ell (`client_id … on delete cascade`). Amb un
--     esborrat de client normal no passa res, però la contradicció hi és igual.
--
-- L'ARREGLA
--
-- Treure el NOT NULL a les dues columnes: el registre es queda, sense autor, que
-- és el que ja volia dir el `on delete set null` (el mateix criteri que
-- l'historial clínic, 0115). L'app no ensenya l'autor enlloc i sempre l'omple en
-- crear; els tipus passen a admetre null.
--
-- Revisat el 17/10/2026: cap altra clau forània cap a `profiles` té aquest
-- problema (`client_videos.uploaded_by`, de la 0027, ja no existeix: 0028).
-- Cap política RLS fa servir aquestes dues columnes.
--
-- Prova: supabase/tests/0116_author_nullable.sql (abans i després).
-- Idempotent: `drop not null` sobre una columna que ja l'admet no fa res.
-- ============================================================================

alter table public.exercise_progress alter column recorded_by drop not null;
alter table public.client_documents  alter column uploaded_by drop not null;

comment on column public.exercise_progress.recorded_by is
  'Qui ho va registrar. NULL si el seu perfil s''ha esborrat (on delete set null; 0116).';
comment on column public.client_documents.uploaded_by is
  'Qui el va pujar. NULL si el seu perfil s''ha esborrat (on delete set null; 0116).';
