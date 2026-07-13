-- ============================================================================
-- VindiBCN · 0016 — Retenció de pagaments en suprimir un client (RGPD + fiscal)
--
-- En exercir el dret de supressió, s'elimina tot el rastre personal del client
-- PERÒ els pagaments s'han de conservar per obligació fiscal. Per fer-ho:
--   · client_id passa a nullable amb ON DELETE SET NULL → el pagament sobreviu
--     desvinculat de la persona (importe, data, mètode… sense dades personals).
--   · s'afegeix `concept` (text pla) perquè el registre contable sàpiga QUÈ es
--     va facturar (p. ex. "Bo 8 sessions · EP Individual"), no només l'import.
-- ============================================================================

alter table public.payments add column if not exists concept text;

alter table public.payments alter column client_id drop not null;

alter table public.payments drop constraint payments_client_id_fkey;

alter table public.payments
  add constraint payments_client_id_fkey
  foreign key (client_id) references public.clients (id) on delete set null;
