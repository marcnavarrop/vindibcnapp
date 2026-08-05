-- ============================================================================
-- VindiBCN · 0045 — Foto de perfil dels professionals
--
-- La columna va a `profiles` i no a una taula nova: és un atribut d'una sola
-- fila per persona, sense historial ni metadades pròpies. Una taula a part
-- només afegiria un JOIN a cada pantalla que ja llegeix el perfil.
--
-- Avui només l'admin en puja (als entrenadors), però la columna no ho limita:
-- el dia que els clients tinguin foto, el model ja hi és.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Ruta al bucket profile-avatars ({profile_id}/{uuid}.{ext}). Null = sense foto, es mostra la inicial.';

-- ─── Bucket privat ──────────────────────────────────────────────────────────
-- Mateix criteri que client-documents i settlement-invoices: mai públic. La
-- foto es serveix amb una signed URL generada al servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  3145728, -- 3 MB: són fotos de perfil
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Convenció de ruta: {profile_id}/{uuid}.{ext}, perquè la política pugui
-- decidir amb split_part sense consultar cap taula.

drop policy if exists "storage_profile_avatars_select" on storage.objects;
create policy "storage_profile_avatars_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (public.is_admin() or split_part(name, '/', 1) = auth.uid()::text)
  );

-- Escriure només l'admin: la foto d'un professional és part de la fitxa que
-- gestiona el centre, no una preferència personal.
drop policy if exists "storage_profile_avatars_insert" on storage.objects;
create policy "storage_profile_avatars_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-avatars' and public.is_admin());

drop policy if exists "storage_profile_avatars_update" on storage.objects;
create policy "storage_profile_avatars_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-avatars' and public.is_admin())
  with check (bucket_id = 'profile-avatars' and public.is_admin());

drop policy if exists "storage_profile_avatars_delete" on storage.objects;
create policy "storage_profile_avatars_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-avatars' and public.is_admin());
