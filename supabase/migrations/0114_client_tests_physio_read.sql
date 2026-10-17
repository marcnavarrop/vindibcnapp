-- ============================================================================
-- VindiBCN · 0114 — Els fisios LLEGEIXEN els tests d'avaluació de qualsevol client
--
-- Decisió d'en Marc (17/10/2026). El fisio és transversal (0109): no s'assigna
-- al client i pot atendre'n qualsevol. Per això ha de poder VEURE els tests
-- d'avaluació (0113) i els seus registres de qualsevol client, en NOMÉS
-- LECTURA. No en crea, no n'edita ni n'esborra cap.
--
-- QUI HI ARRIBA, DESPRÉS D'AQUESTA MIGRACIÓ
--
--                         llegir          escriure
--   admin                 tot             tot
--   professional ASSIGNAT el seu client   el seu client
--   fisio (qualsevol)     tot             res (llevat dels clients que té
--                                         assignats, com fins ara)
--   altres professionals  res             res
--   el client dueny       els seus        res
--
-- Sempre `same_world` (0110): un fisio demo només hi veu clients demo, i un fisio
-- real no en veu mai cap de demo.
--
-- COM: DUES POLÍTIQUES NOVES, NOMÉS DE LECTURA
--
-- Són PERMISSIVES i de `select`: Postgres les combina amb un OR amb les de la
-- 0113, que no es toquen. Les d'escriptura (`client_tests_write` i
-- `client_test_entries_write`) tampoc: segueixen preguntant a
-- `client_tests_can_write`, on el fisio no hi és.
--
-- `is_physio()` és «professional amb especialitat fisioterapeuta» (0110), i
-- l'especialitat només la canvia l'admin.
--
-- SI L'ASSESSOR DIU QUE SÓN DADES DE SALUT
--
-- A més de reescriure `client_tests_can_read` (vegeu la 0113), cal revisar
-- aquestes dues polítiques: també donen lectura.
--
-- Idempotent: `drop policy if exists` abans de crear-les.
-- ============================================================================

drop policy if exists "client_tests_select_physio" on public.client_tests;
create policy "client_tests_select_physio" on public.client_tests
  for select to authenticated
  using (public.is_physio() and public.same_world(client_id));

drop policy if exists "client_test_entries_select_physio" on public.client_test_entries;
create policy "client_test_entries_select_physio" on public.client_test_entries
  for select to authenticated
  using (public.is_physio() and public.same_world(client_id));

comment on policy "client_tests_select_physio" on public.client_tests is
  'Els fisios llegeixen els tests de qualsevol client del seu món, sense escriure-hi (0114).';
comment on policy "client_test_entries_select_physio" on public.client_test_entries is
  'Els fisios llegeixen els registres dels tests de qualsevol client del seu món, sense escriure-hi (0114).';
