-- ============================================================================
-- VindiBCN · 0035 — Separació de les notes de client en dues categories
--
-- `clients.notes` era un únic camp lliure que barrejava informació clínica
-- (lesions, fisioteràpia) amb informació de gestió (preferències d'horari,
-- objectius). Es divideix en dues columnes per poder-les llegir separades.
--
-- El contingut existent va tot a `general_notes`: no es pot deduir de forma
-- fiable què era clínic i què no, i classificar-ho malament seria pitjor que
-- no classificar-ho. `clinical_notes` neix buida i s'omple a mà.
--
-- NO es toca cap política de RLS: qui podia llegir o escriure `notes` continua
-- podent llegir i escriure les dues columnes noves exactament igual, perquè
-- les polítiques de `clients` són a nivell de fila, no de columna.
-- ============================================================================

alter table public.clients
  add column if not exists clinical_notes text,
  add column if not exists general_notes  text;

-- Migració del contingut. Idempotent: només omple general_notes si encara és
-- buida, de manera que reexecutar-ho no sobreescriu res editat després.
update public.clients
set general_notes = notes
where notes is not null
  and general_notes is null;

-- La columna antiga es manté per seguretat fins a validar el desplegament.
-- Un cop verificat, es pot eliminar amb:
--   alter table public.clients drop column notes;
comment on column public.clients.notes is
  'OBSOLETA: substituïda per general_notes i clinical_notes (0035). Pendent d''eliminar.';

comment on column public.clients.clinical_notes is
  'Notes de salut i fisioteràpia (lesions, limitacions, seguiment clínic).';
comment on column public.clients.general_notes is
  'Notes d''entrenament, preferències i gestió.';
