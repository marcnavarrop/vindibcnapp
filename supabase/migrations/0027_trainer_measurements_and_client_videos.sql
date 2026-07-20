-- VindiBCN · 0027 — Vídeos del professional per al client
-- (Les mesures ja tenien is_trainer_of a la política d'escriptura — sense canvis.)
--
-- DECISIÓ: taula + bucket separats de client_documents perquè el límit de mida
-- és a nivell de bucket (15 MB docs vs 200 MB vídeos).

-- ─── Storage bucket ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-videos',
  'client-videos',
  false,
  209715200, -- 200 MB
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Lectura: admin, trainer assignat o el propi client.
create policy "storage_client_videos_select"
  on storage.objects for select
  using (
    bucket_id = 'client-videos'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or exists (
        select 1 from public.clients c
        where c.id::text = split_part(name, '/', 1)
          and (c.profile_id = auth.uid() or c.assigned_trainer_id = auth.uid())
      )
    )
  );

-- Pujada: admin o trainer assignat (NO el propi client).
create policy "storage_client_videos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'client-videos'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or exists (
        select 1 from public.clients c
        where c.id::text = split_part(name, '/', 1)
          and c.assigned_trainer_id = auth.uid()
      )
    )
  );

-- Eliminació: admin o trainer assignat al client.
create policy "storage_client_videos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'client-videos'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or exists (
        select 1 from public.clients c
        where c.id::text = split_part(name, '/', 1)
          and c.assigned_trainer_id = auth.uid()
      )
    )
  );

-- ─── Taula de metadades ──────────────────────────────────────────────────────

create table public.client_videos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  storage_path text not null,
  file_name    text not null,
  file_size    integer,
  mime_type    text,
  description  text,
  uploaded_at  timestamptz not null default now()
);

alter table public.client_videos enable row level security;

-- Lectura: admin, trainer assignat o el propi client.
create policy "client_videos_select"
  on public.client_videos for select
  using (
    public.is_admin()
    or public.is_trainer_of(client_id)
    or public.owns_client(client_id)
  );

-- Pujada: admin o trainer assignat.
create policy "client_videos_insert"
  on public.client_videos for insert
  with check (
    public.is_admin()
    or public.is_trainer_of(client_id)
  );

-- Eliminació: qui ha pujat el vídeo o admin.
create policy "client_videos_delete"
  on public.client_videos for delete
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
  );
