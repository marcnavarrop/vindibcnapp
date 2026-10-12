-- ============================================================================
-- VindiBCN · 0106 — La resposta d'un tiquet de suport
--
-- Fins ara un tiquet només tenia estat: la resposta anava per correu o per
-- WhatsApp i a l'app no en quedava rastre. Ara l'admin hi escriu UNA resposta
-- (i la pot corregir), qui l'ha obert la veu sota el seu tiquet i li arriba un
-- correu.
--
-- UNA RESPOSTA, NO UNA CONVERSA
--
-- Són tres columnes a la mateixa fila i no una taula de missatges a posta. Amb
-- el volum que té el suport (set tiquets en un mes) i preguntes curtes, un fil
-- seria més pantalla i més permisos per a res. Si un dia cal conversa, la
-- resposta d'avui passa a ser el primer missatge d'una taula nova sense perdre
-- res.
--
-- NO ES TOCA CAP POLÍTICA
--
-- · Llegir: `support_tickets_select` (0047) ja deixa veure la fila sencera a
--   l'admin i a qui l'ha obert. La resposta va amb la fila.
-- · Escriure: `support_tickets_admin_update` (0047) ja és només de l'admin.
--   El professional no pot escriure-hi res, tampoc la resposta.
--
-- `answered_by` pot quedar NULL si qui va respondre es dona de baixa: la
-- resposta sobreviu, perd la signatura (el mateix criteri de la 0079).
--
-- Idempotent: `add column if not exists` i la constraint es torna a crear.
-- ============================================================================

alter table public.support_tickets
  add column if not exists answer      text,
  add column if not exists answered_at timestamptz,
  add column if not exists answered_by uuid references public.profiles (id) on delete set null;

-- Una resposta buida no és una resposta: o hi ha text, o la columna és NULL.
-- El límit és el mateix que el de la descripció.
alter table public.support_tickets
  drop constraint if exists support_tickets_answer_check;
alter table public.support_tickets
  add constraint support_tickets_answer_check
  check (answer is null or length(btrim(answer)) between 1 and 5000);

comment on column public.support_tickets.answer is
  'La resposta de l''admin a qui ha obert el tiquet (0106). Una sola, editable.';
comment on column public.support_tickets.answered_at is
  'Quan es va desar (o corregir) la resposta per últim cop.';
comment on column public.support_tickets.answered_by is
  'Qui la va escriure. NULL si s''ha donat de baixa.';
