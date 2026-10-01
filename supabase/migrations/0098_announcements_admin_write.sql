-- 0098 · Anuncis: només l'admin els escriu.
--
-- Fins ara `announcements_write` (0004) deixava crear, editar i esborrar
-- anuncis a l'admin I al professional, de qualsevol autor. A l'app només
-- publica l'admin (/admin/community; l'acció ja exigeix requireRole("admin")
-- des del correu de la comunitat) i cap pantalla del professional hi escriu:
-- /trainer/comunitat només llegeix. La RLS ho deixa igual que l'app.
--
-- La lectura (`announcements_select`, qualsevol sessió) no canvia.
--
-- `is_admin()` torna NULL sense perfil: en una política, NULL és «no», així
-- que no cal el coalesce de les funcions (0095/0096).
--
-- Idempotent: es pot tornar a aplicar.

drop policy if exists "announcements_write" on public.announcements;
drop policy if exists "announcements_insert_admin" on public.announcements;
drop policy if exists "announcements_update_admin" on public.announcements;
drop policy if exists "announcements_delete_admin" on public.announcements;

create policy "announcements_insert_admin" on public.announcements
  for insert with check (public.is_admin());

create policy "announcements_update_admin" on public.announcements
  for update using (public.is_admin()) with check (public.is_admin());

create policy "announcements_delete_admin" on public.announcements
  for delete using (public.is_admin());
