-- ============================================================================
-- VindiBCN · 0056 — El professional pot cobrar el bo del seu client
--
-- Fins ara podia crear-li un bo però no marcar-lo com a pagat: la decisió
-- original era que "els pagaments són competència de l'admin". A la pràctica
-- qui té el client al davant amb els diners a la mà és el professional, i
-- havia d'anar a buscar l'admin per a una cosa que ja estava feta.
--
-- El bo NO necessita cap canvi: `bonos_trainer_write` (0005) ja és FOR ALL amb
-- `is_trainer_of(client_id)`, de manera que l'UPDATE que passa el bo a 'active'
-- ja estava permès. El que faltava era el cobrament: `markBonoPaid` també
-- insereix una fila a `payments`, i allà l'única política d'escriptura és
-- `payments_admin_write`. Un professional es trobava un error de RLS a mitja
-- operació, amb el bo ja activat i el cobrament sense registrar.
--
-- Per això aquí només s'obre l'INSERT, i només per al seu client assignat:
--
--   · INSERT  → sí, és el que necessita per cobrar.
--   · UPDATE  → no. Corregir un import ja cobrat és una esmena comptable, i
--               això segueix sent de l'admin.
--   · DELETE  → no. Un cobrament no s'esborra; això ja ho diu la 0016, que va
--               desvincular els pagaments del client precisament per conservar
--               l'històric quan el client marxa.
--
-- `is_trainer_of(null)` retorna false, així que les files de retenció amb
-- client_id nul (0016) queden fora d'aquesta política tota soles.
-- ============================================================================

drop policy if exists "payments_trainer_insert" on public.payments;
create policy "payments_trainer_insert" on public.payments
  for insert
  with check (public.is_trainer_of(client_id));

comment on policy "payments_trainer_insert" on public.payments is
  'El professional pot registrar un cobrament d''un client seu (marcar un bo com pagat). Només INSERT: esmenar o esborrar un cobrament segueix sent de l''admin.';
