-- Bucket privat per als documents dels clients.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  15728640, -- 15 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: el client puja/esborra els seus; admin/trainer assignat els veuen.
-- Usem storage_path amb prefix {client_id}/ per identificar a qui pertany.

create policy "storage_client_documents_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'client-documents'
    and auth.role() = 'authenticated'
    and (
      -- El client pot pujar al seu propi prefixe: {client_id}/...
      exists (
        select 1 from public.clients c
        where c.id::text = split_part(name, '/', 1)
          and c.profile_id = auth.uid()
      )
    )
  );

create policy "storage_client_documents_select"
  on storage.objects for select
  using (
    bucket_id = 'client-documents'
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

create policy "storage_client_documents_delete"
  on storage.objects for delete
  using (
    bucket_id = 'client-documents'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or exists (
        select 1 from public.clients c
        where c.id::text = split_part(name, '/', 1)
          and c.profile_id = auth.uid()
      )
    )
  );

-- Taula de metadades dels documents.
create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  file_size integer,
  mime_type text,
  description text,
  uploaded_at timestamptz not null default now()
);

alter table public.client_documents enable row level security;

create policy "client_documents_select"
  on public.client_documents for select
  using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

create policy "client_documents_insert"
  on public.client_documents for insert
  with check (public.owns_client(client_id));

create policy "client_documents_delete"
  on public.client_documents for delete
  using (public.is_admin() or public.owns_client(client_id));
