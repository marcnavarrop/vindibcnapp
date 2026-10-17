-- ============================================================================
-- VindiBCN · 0117 — Tests d'avaluació: crear-ne demana el consentiment de salut
--
-- Decisió d'en Marc (17/10/2026): els tests d'avaluació (0113/0114) són DADES DE
-- SALUT, com l'historial clínic. Són mesures corporals acumulades en el temps,
-- amb gràfica i visibles per al fisio, i se'n pot deduir l'estat de salut
-- (criteri del Grup de l'Article 29).
--
-- QUÈ CANVIA
--
-- Només es poden CREAR tests i registres si el client té signat el
-- consentiment de dades de salut. Llegir, editar i esborrar el que ja hi ha
-- segueix igual.
--
-- COM
--
-- Dues polítiques RESTRICTIVES, només d'INSERT. Una política restrictiva
-- s'aplica A MÉS de les permissives (AND): les de la 0113 i la 0114 no es
-- toquen, i UPDATE, DELETE i SELECT no hi passen.
--
-- La regla viu en una funció, `client_tests_consent_ok`, que avui només
-- pregunta a `health_consent_status` (0110) si hi ha cap consentiment de salut.
-- Si l'assessor demana que només compti la versió nova del text del
-- consentiment, es canvia aquesta funció i prou.
--
-- `health_consent_status` és SECURITY DEFINER però només torna fila a l'admin,
-- als fisios i a l'entrenador assignat (i sempre `same_world`): justament qui
-- pot escriure tests. Ningú més no n'obté res de nou.
--
-- L'historial clínic NO bloqueja l'escriptura sense consentiment (només
-- n'avisa, decisió d'en Marc a la 0110). Aquesta migració no el toca.
--
-- Idempotent: `create or replace` i `drop policy if exists`.
-- ============================================================================

create or replace function public.client_tests_consent_ok(p_client uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (select 1 from public.health_consent_status(p_client))
$$;

comment on function public.client_tests_consent_ok(uuid) is
  'Es poden crear tests d''avaluació per a aquest client: té el consentiment de dades de salut signat (0117).';

revoke execute on function public.client_tests_consent_ok(uuid) from public, anon;
grant  execute on function public.client_tests_consent_ok(uuid) to authenticated;

drop policy if exists "client_tests_insert_consent" on public.client_tests;
create policy "client_tests_insert_consent" on public.client_tests
  as restrictive
  for insert to authenticated
  with check (public.client_tests_consent_ok(client_id));

-- El `client_id` del registre el posa el trigger (0113) a partir del test, abans
-- que es comprovi la política.
drop policy if exists "client_test_entries_insert_consent" on public.client_test_entries;
create policy "client_test_entries_insert_consent" on public.client_test_entries
  as restrictive
  for insert to authenticated
  with check (public.client_tests_consent_ok(client_id));

comment on policy "client_tests_insert_consent" on public.client_tests is
  'Crear un test demana el consentiment de salut del client (0117). Restrictiva: s''hi suma a les de la 0113.';
comment on policy "client_test_entries_insert_consent" on public.client_test_entries is
  'Crear un registre demana el consentiment de salut del client (0117). Restrictiva: s''hi suma a les de la 0113.';
