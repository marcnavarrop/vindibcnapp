-- VindiBCN · 0028
-- Part A: Revertir client_videos (migració 0027)
-- Part B: Vídeo propi per exercici de biblioteca

-- ─── Part A: DROP client_videos ─────────────────────────────────────────────

drop policy if exists "storage_client_videos_select" on storage.objects;
drop policy if exists "storage_client_videos_insert" on storage.objects;
drop policy if exists "storage_client_videos_delete" on storage.objects;

delete from storage.buckets where id = 'client-videos';

drop table if exists public.client_videos;

-- ─── Part B: Vídeo propi per exercici ───────────────────────────────────────

-- Nova columna a exercises: ruta en Storage del vídeo pujat pel trainer/admin.
-- S'usa com a alternativa a video_url (no ambdós a la vegada — validat al formulari).
alter table public.exercises
  add column if not exists video_file_path text null;

-- Bucket privat per als vídeos d'exercicis
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos',
  'exercise-videos',
  false,
  209715200, -- 200 MB
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Lectura: qualsevol usuari autenticat (tots els rols veuen els exercicis)
create policy "storage_exercise_videos_select"
  on storage.objects for select
  using (
    bucket_id = 'exercise-videos'
    and auth.role() = 'authenticated'
  );

-- Pujada: admin o trainer
create policy "storage_exercise_videos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'exercise-videos'
    and auth.role() = 'authenticated'
    and (public.is_admin() or public.is_trainer())
  );

-- Actualització (remplazar fitxer): admin o trainer
create policy "storage_exercise_videos_update"
  on storage.objects for update
  using (
    bucket_id = 'exercise-videos'
    and auth.role() = 'authenticated'
    and (public.is_admin() or public.is_trainer())
  );

-- Eliminació: admin o trainer
create policy "storage_exercise_videos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'exercise-videos'
    and auth.role() = 'authenticated'
    and (public.is_admin() or public.is_trainer())
  );
