-- ============================================================================
-- VindiBCN · 0068 — Etiquetes de client
--
-- Text lliure, no una llista tancada: el centre crea les que necessiti ("VIP",
-- "Empresa", "Rehabilitació"…) i un client en pot tenir diverses. Serveixen per
-- segmentar ofertes (0069) i, més endavant, per a qualsevol altra cosa que
-- vulgui parlar d'un grup de clients sense inventar-se una columna nova.
--
-- PER QUÈ NO SÓN VISIBLES PER AL CLIENT
--
-- `promotions_select` (0023) és `to authenticated using (true)`: qualsevol
-- client autenticat llegeix TOTES les ofertes. Si una oferta guardés el NOM de
-- l'etiqueta, el vocabulari intern del centre quedaria a l'abast de qui obrís
-- les eines de xarxa. La 0069 hi guarda només un uuid, que no diu res, i
-- aquestes dues taules queden tancades a personal: ni el propi client llegeix
-- les seves etiquetes.
--
-- Conseqüència de disseny, escrita aquí perquè no es perdi: el càlcul de preu
-- del client (/client/bonos) NO pot resoldre el segment amb la sessió de qui
-- mira. Ho fa per `service_role`, com ja fa `quoteBonoPurchase`.
-- ============================================================================

create table if not exists public.client_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

comment on table public.client_tags is
  'Catàleg d''etiquetes de client, de text lliure. Només l''admin les crea, reanomena o esborra.';

-- Sense distingir majúscules ni espais als extrems: "VIP", "vip" i " VIP " són
-- la mateixa etiqueta. Evita el catàleg brut que surt de teclejar-les a mà.
create unique index if not exists client_tags_name_uidx
  on public.client_tags (lower(trim(name)));

create table if not exists public.client_tag_assignments (
  client_id   uuid not null references public.clients (id)     on delete cascade,
  tag_id      uuid not null references public.client_tags (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (client_id, tag_id)
);

comment on table public.client_tag_assignments is
  'Quines etiquetes té cada client. La clau primària composta ja impedeix assignar dues vegades la mateixa.';

-- La PK ja cobreix "quines etiquetes té aquest client". Aquest índex cobreix la
-- direcció contrària —"quins clients tenen aquesta etiqueta"—, que és la que fa
-- servir el recompte del catàleg i la que faria servir qualsevol llistat futur.
create index if not exists client_tag_assignments_tag
  on public.client_tag_assignments (tag_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.client_tags            enable row level security;
alter table public.client_tag_assignments enable row level security;

-- Catàleg: el llegeix qualsevol professional (l'ha de veure per assignar-la);
-- només l'admin l'escriu.
drop policy if exists "client_tags_select" on public.client_tags;
create policy "client_tags_select" on public.client_tags
  for select to authenticated
  using (public.is_admin() or public.is_trainer());

drop policy if exists "client_tags_write" on public.client_tags;
create policy "client_tags_write" on public.client_tags
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Assignacions: mateix criteri que `client_exercises` (0012), menys el client.
-- L'admin i l'entrenador/a assignat les veuen i les toquen; el client, ni una
-- cosa ni l'altra —una etiqueta és una nota del centre sobre ell, no per a ell.
drop policy if exists "client_tag_assignments_select" on public.client_tag_assignments;
create policy "client_tag_assignments_select" on public.client_tag_assignments
  for select to authenticated
  using (public.is_admin() or public.is_trainer_of(client_id));

drop policy if exists "client_tag_assignments_write" on public.client_tag_assignments;
create policy "client_tag_assignments_write" on public.client_tag_assignments
  for all to authenticated
  using  (public.is_admin() or public.is_trainer_of(client_id))
  with check (public.is_admin() or public.is_trainer_of(client_id));
