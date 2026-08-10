-- ============================================================================
-- VindiBCN · 0047 — Suport tècnic intern
--
-- Canal perquè l'equip del centre (admin i professionals) reporti errors,
-- dubtes i idees sobre l'app. No és per als clients: és comunicació interna
-- cap a qui la desenvolupa.
-- ============================================================================

create type public.support_category as enum ('bug', 'pregunta', 'suggeriment');
create type public.support_status   as enum ('open', 'in_progress', 'resolved');

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 150),
  description text not null check (length(btrim(description)) between 1 and 5000),
  category    public.support_category not null,
  status      public.support_status   not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.support_tickets is
  'Incidències i dubtes que l''equip del centre reporta a qui desenvolupa l''app.';

-- El llistat sempre és "els meus / tots" ordenat per data.
create index if not exists support_tickets_author_idx
  on public.support_tickets (created_by, created_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);

-- updated_at el manté la base: així no depèn que cap camí de codi se'n recordi.
create or replace function public.touch_support_ticket()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.touch_support_ticket();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.support_tickets enable row level security;

-- SELECT: l'admin ho veu tot; el professional, només el que ha obert ell.
drop policy if exists "support_tickets_select" on public.support_tickets;
create policy "support_tickets_select" on public.support_tickets
  for select using (public.is_admin() or created_by = auth.uid());

-- INSERT: admin i professional, i sempre a nom propi. El `with check` sobre
-- created_by és el que impedeix obrir un tiquet fent-se passar per un altre;
-- que el codi hi posi auth.uid() no n'hi hauria prou, perquè la RLS també
-- protegeix l'accés directe a l'API.
drop policy if exists "support_tickets_insert" on public.support_tickets;
create policy "support_tickets_insert" on public.support_tickets
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_admin() or public.is_trainer())
  );

-- UPDATE: només l'admin, que és qui parla amb qui desenvolupa i sap si una
-- cosa ja està resolta. El professional el veu, però no el pot tancar.
drop policy if exists "support_tickets_admin_update" on public.support_tickets;
create policy "support_tickets_admin_update" on public.support_tickets
  for update using (public.is_admin()) with check (public.is_admin());
