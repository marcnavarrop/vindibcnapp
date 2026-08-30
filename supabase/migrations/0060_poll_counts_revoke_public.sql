-- ============================================================================
-- VindiBCN · 0060 — Tancar el que la 0059 es va deixar obert
--
-- La 0059 diu, al seu propi comentari, que només qui està identificat pot
-- cridar `poll_option_counts`. No era veritat. PostgreSQL dóna EXECUTE a
-- PUBLIC per defecte en crear una funció, i el `grant ... to authenticated`
-- que hi vaig posar SUMA permisos: no en treu cap. El resultat és que un
-- visitant sense sessió, amb la clau anònima —que és pública per definició—,
-- podia demanar el recompte de vots d'una enquesta.
--
-- Comprovat contra producció: la crida anònima retornava els números.
--
-- Fins on arribava: NOMÉS el recompte agregat, i només si ja tenies l'UUID de
-- l'enquesta. La RLS de `poll_responses` seguia sencera (llegir les files
-- directament torna zero per a l'anònim), així que en cap moment ha sortit
-- d'aquí qui ha votat què, i `polls` tampoc deixa llistar els identificadors
-- sense sessió. És a dir: exposició petita i improbable, però la funció no
-- feia el que el seu comentari prometia, i això s'arregla.
--
-- La lliçó, per si torna a sortir una funció SECURITY DEFINER: el `grant` no
-- serveix de res sense el `revoke` de davant.
-- ============================================================================

revoke execute on function public.poll_option_counts(uuid[]) from public;
grant  execute on function public.poll_option_counts(uuid[]) to authenticated;
