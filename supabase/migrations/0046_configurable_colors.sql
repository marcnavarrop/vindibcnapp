-- ============================================================================
-- VindiBCN · 0046 — Colors configurables (professionals i tipus de servei)
--
-- Fins ara els colors vivien al codi: la paleta de `lib/pro-colors.ts` (per
-- professional, derivada d'un hash de l'id) i `SERVICE_COLORS` de
-- `lib/labels.ts` (per tipus de servei). Passen a ser dades editables per
-- l'admin, sense canviar ni on ni com es fan servir.
--
-- Dues taules i no una de genèrica: la clau d'una és un professional i la de
-- l'altra un valor de l'enum. Una taula "settings" amb clau de text hauria
-- perdut les dues claus foranes i el control d'integritat que donen.
-- ============================================================================

-- Hex de 6 dígits amb coixinet. La restricció és al model i no només al
-- formulari perquè el color s'injecta dins d'un `style` del calendari: un
-- valor arbitrari hi entraria tal qual.
create table if not exists public.professional_colors (
  trainer_id uuid primary key
    references public.profiles (id) on delete cascade,
  color      text        not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);

comment on table public.professional_colors is
  'Color de cada professional als calendaris. Sense fila = color per defecte del codi (paleta de pro-colors.ts).';

create table if not exists public.service_type_colors (
  service_type public.service_type primary key,
  color        text        not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at   timestamptz not null default now()
);

comment on table public.service_type_colors is
  'Color de cada tipus de servei als calendaris i a la compra de bons.';

-- ─── Llavor dels tipus de servei ────────────────────────────────────────────
-- Exactament els quatre colors que ja fa servir el codi avui, perquè res no
-- canviï visualment fins que l'admin en toqui un.
insert into public.service_type_colors (service_type, color) values
  ('ep_individual',  '#642263'),  -- lila de marca
  ('ep_parejas',     '#965495'),  -- lila clar
  ('grupo_reducido', '#ff6d17'),  -- taronja d'accent
  ('fisioterapia',   '#1d8a8a')   -- verd-blau
on conflict (service_type) do nothing;

-- Els professionals que ja existeixen NO es sembren a propòsit: sense fila,
-- el codi els segueix donant el mateix color derivat de l'id que tenien fins
-- ara, així que ningú no veu cap canvi. Els nous sí que reben color en donar-
-- los d'alta (el següent lliure de la paleta), i l'admin pot canviar-los tots.

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.professional_colors enable row level security;
alter table public.service_type_colors enable row level security;

-- SELECT obert a qualsevol autenticat: cal per pintar els calendaris, i un
-- color no és cap dada sensible.
drop policy if exists "professional_colors_select" on public.professional_colors;
create policy "professional_colors_select" on public.professional_colors
  for select using (auth.uid() is not null);

drop policy if exists "service_type_colors_select" on public.service_type_colors;
create policy "service_type_colors_select" on public.service_type_colors
  for select using (auth.uid() is not null);

-- Escriure, només l'admin: la paleta és una decisió del centre, no una
-- preferència de cadascú.
drop policy if exists "professional_colors_admin_write" on public.professional_colors;
create policy "professional_colors_admin_write" on public.professional_colors
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "service_type_colors_admin_write" on public.service_type_colors;
create policy "service_type_colors_admin_write" on public.service_type_colors
  for all using (public.is_admin()) with check (public.is_admin());
