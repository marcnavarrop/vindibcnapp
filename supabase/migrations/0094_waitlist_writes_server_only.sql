-- ============================================================================
-- VindiBCN · 0094 — La llista d'espera només l'escriu el servidor
--
-- FINS ARA
--
-- La 0049 deixava que un client INSERÍS, MODIFIQUÉS i ESBORRÉS les seves
-- pròpies entrades de `waitlist_entries` directament contra l'API de Supabase
-- (`owns_client(client_id)`), amb la seva sessió i la clau pública. Cap
-- pantalla de l'app ho fa servir: apuntar-se (`joinWaitlist`), desapuntar-se
-- (`cancelWaitlistEntry`), les esperes de les sèries, la promoció i el
-- tancament per part del centre escriuen totes amb el client de servei
-- (`createAdminClient`). Però la porta era oberta, i per ella es podia:
--
--   · Apuntar-se a qualsevol franja saltant-se totes les regles de
--     `joinWaitlist`: la cua tancada pel centre, el bo, que la franja estigui
--     plena, i ara també QUI pot fer la sessió (individual i parelles, només
--     amb l'entrenador assignat; vegeu `lib/booking-scope.ts`).
--   · Canviar el professional, l'hora o el servei d'una entrada ja feta, o
--     marcar-la com a 'fulfilled' sense cap reserva al darrere.
--   · Esborrar entrades d'una sèrie, que el resum de la sèrie compta com a
--     ocurrències col·locades.
--
-- QUÈ CANVIA
--
-- Escriure (insert, update, delete) queda per a l'admin; el servidor ho segueix
-- fent amb el client de servei, que no passa per la RLS. LLEGIR no canvia: el
-- client continua veient les seves entrades i l'admin totes (`waitlist_select`
-- de la 0049 es queda tal com és).
--
-- Les funcions `security definer` (0091) no hi escriuen, i si ho fessin
-- correrien com a propietari, fora de la RLS.
-- ============================================================================

drop policy if exists "waitlist_insert" on public.waitlist_entries;
create policy "waitlist_insert" on public.waitlist_entries
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "waitlist_update" on public.waitlist_entries;
create policy "waitlist_update" on public.waitlist_entries
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "waitlist_delete" on public.waitlist_entries;
create policy "waitlist_delete" on public.waitlist_entries
  for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- VERIFICACIÓ (només lectura). Ha de tornar quatre files:
--   waitlist_select  SELECT  … is_admin() OR owns_client(client_id)
--   waitlist_insert  INSERT  with_check = is_admin()
--   waitlist_update  UPDATE  qual = is_admin(), with_check = is_admin()
--   waitlist_delete  DELETE  qual = is_admin()
--
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'waitlist_entries'
--   order by policyname;
-- ----------------------------------------------------------------------------
