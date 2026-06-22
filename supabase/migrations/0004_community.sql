-- ============================================================================
-- VindiBCN · Comunitat (tablón de anuncios)
-- Publicaciones del centro: sopars, grupos nuevos, novedades. Las crean
-- admin/entrenadores; las lee cualquier usuario autenticado.
-- ============================================================================

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.profiles (id) on delete set null,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index idx_announcements_created on public.announcements (created_at desc);

alter table public.announcements enable row level security;

-- Lectura: cualquier usuario autenticado. Escritura: admin o trainer.
create policy "announcements_select" on public.announcements
  for select using (auth.uid() is not null);

create policy "announcements_write" on public.announcements
  for all
  using (public.current_role() in ('admin', 'trainer'))
  with check (public.current_role() in ('admin', 'trainer'));
