-- ============================================================================
-- VindiBCN · 0110 — L'historial clínic: «Primera visita» i «Seguiment»
--
-- Tiquet d'en Sergi (8/10) i decisions d'en Marc (13/10/2026). Substitueix
-- `clients.clinical_notes` (un sol camp lliure) per una taula pròpia, amb la
-- seva RLS:
--
--   · «Primera visita» (`clinical_first_visits`): UNA per client. La clau
--     primària és el client.
--   · «Seguiment» (`clinical_followups`): entrades amb data, autor i text.
--
-- QUI HI ARRIBA (la regla sencera, a les polítiques de sota)
--
--                         llegir   primera visita   seguiment            esborrar
--   admin                 tot      crear i editar   crear i editar tots  sí
--   fisioterapeuta        tot      crear i editar   crear; editar els    no
--   (qualsevol client)                              SEUS
--   entrenador ASSIGNAT   el seu   no               no                   no
--   altres entrenadors    res      —                —                    —
--   el client             res      —                —                    —
--
-- El fisio és transversal (0109): no s'assigna al client, i per això aquí no
-- hi ha cap «fisio d'aquest client». L'entrenador sí: només el seu
-- (`is_trainer_of`). El client no hi té accés a l'app; si demana les seves
-- dades, l'historial va a l'exportació (l'app, amb la clau de servei).
--
-- «DEMO AMB DEMO» TAMBÉ A LA BASE (només per a l'historial)
--
-- Fins ara la separació dels comptes demo vivia NOMÉS a l'app
-- (`lib/demo-accounts.ts`, tres ids escrits al codi). Aquí no n'hi ha prou:
-- `is_physio()` és cert per al Fisio Demo, i amb la seva sessió podria llegir
-- per l'API l'historial de clients reals. Per això la base passa a saber quins
-- perfils són demo (`demo_profiles`, que només s'omple per migració o des del
-- SQL Editor: cap política hi deixa escriure ningú) i les portes de
-- l'historial no creuen mai demo i real (`same_world`):
--
--   · un professional demo només hi veu clients demo;
--   · un professional real no hi veu mai clients demo;
--   · l'admin ho veu tot.
--
-- Els tres ids són els mateixos de `lib/demo-accounts.ts`: si mai en canvia
-- un, s'han de canviar tots dos llocs.
--
-- QUÈ MÉS PORTA
--
--   · `demo_profiles`, `is_demo_profile()` i `same_world(client)`: vegeu dalt.
--   · `is_physio()`: professional amb especialitat `fisioterapeuta`.
--   · `clinical_seen`: fins quan ha vist cadascú l'historial de cada client.
--     És el que fa l'avís de novetat a l'entrenador assignat.
--   · `health_consent_status(client)`: si ha signat el consentiment de salut i
--     quan, i res més (ni la IP ni el de privacitat). Per al fisio i
--     l'entrenador assignat, que no llegeixen `consents` (0014). `consents` no
--     té cap manera de revocar un consentiment (comprovat el 13/10/2026: ni
--     columna ni tipus de fila); el dia que n'hi hagi, aquesta funció l'ha de
--     comptar com a no signat.
--   · `data_access_log` admet l'acció 'clinical_view': l'app hi deixa una fila
--     cada cop que algú que no és admin obre un historial (amb la clau de
--     servei, com les exportacions; la política de la 0015 no es toca). Les
--     del Client Demo no s'hi registren (decisió d'en Marc): aquest registre
--     és la prova de compliment i no s'ha d'omplir amb proves.
--   · Còpia de `clients.clinical_notes` a «Primera visita». La columna vella
--     NO es toca aquí: la buidarà i en traurà l'accés una segona migració,
--     quan l'app ja no la faci servir i s'hagi verificat.
--
-- Idempotent: `if not exists`, `create or replace`, `drop … if exists` i la
-- còpia amb `on conflict do nothing`.
-- ============================================================================

-- ─── 0. Quins perfils són demo ───────────────────────────────────────────────
--
-- Una taula i no una columna a `profiles`: així ningú amb sessió no la pot
-- tocar (RLS sense cap política i sense permisos per a `authenticated`), i
-- marcar-ne o desmarcar-ne un és una decisió que es fa a mà, per migració o al
-- SQL Editor. Les funcions de sota la llegeixen com a `security definer`.

create table if not exists public.demo_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  label      text not null
);

comment on table public.demo_profiles is
  'Perfils dels comptes de demostració (0110). Els mateixos de lib/demo-accounts.ts. Només s''omple per migració o SQL Editor.';

alter table public.demo_profiles enable row level security;
revoke all on public.demo_profiles from anon;
revoke all on public.demo_profiles from authenticated;

-- Els tres comptes demo d'avui. Si algun no existeix (un entorn sense ells), no
-- s'hi insereix res: la FK ho impediria i el `where exists` ho evita.
insert into public.demo_profiles (profile_id, label)
select v.id, v.label
from (values
  ('5119e112-74af-4c85-862b-829f6d726ea2'::uuid, 'Entrenador Demo'),
  ('1c36928b-0668-4377-a5d8-c7befb2d78bc'::uuid, 'Fisio Demo'),
  ('d3b42dcb-7c11-4431-abc0-723b21add106'::uuid, 'Client Demo')
) as v(id, label)
where exists (select 1 from public.profiles p where p.id = v.id)
on conflict (profile_id) do nothing;

create or replace function public.is_demo_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.demo_profiles d where d.profile_id = p_profile)
$$;

comment on function public.is_demo_profile(uuid) is
  'Aquest perfil és un compte de demostració (demo_profiles, 0110).';

revoke execute on function public.is_demo_profile(uuid) from public;
revoke execute on function public.is_demo_profile(uuid) from anon;
grant  execute on function public.is_demo_profile(uuid) to authenticated;

-- Qui mira i aquest client són del mateix món: tots dos demo o tots dos reals.
create or replace function public.same_world(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_demo_profile(auth.uid()) = exists (
    select 1
    from public.clients c
    join public.demo_profiles d on d.profile_id = c.profile_id
    where c.id = p_client
  )
$$;

comment on function public.same_world(uuid) is
  'Qui mira i aquest client (clients.id) són tots dos demo o tots dos reals (0110). Demo amb demo també a la base.';

revoke execute on function public.same_world(uuid) from public;
revoke execute on function public.same_world(uuid) from anon;
grant  execute on function public.same_world(uuid) to authenticated;

-- ─── 1. Qui és fisio ─────────────────────────────────────────────────────────

create or replace function public.is_physio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'trainer'
      and p.specialty = 'fisioterapeuta'
  )
$$;

comment on function public.is_physio() is
  'Professional amb especialitat fisioterapeuta (0110). L''especialitat només la canvia l''admin.';

revoke execute on function public.is_physio() from public;
revoke execute on function public.is_physio() from anon;
grant  execute on function public.is_physio() to authenticated;

-- ─── 2. Les taules ───────────────────────────────────────────────────────────

create table if not exists public.clinical_first_visits (
  client_id  uuid primary key references public.clients (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 20000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.clinical_first_visits is
  'Historial clínic: la «Primera visita» de cada client, una per client (0110). Llegeixen admin, fisios i l''entrenador assignat; escriuen admin i fisios; esborra l''admin.';

create table if not exists public.clinical_followups (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  -- Qui la va escriure. NULL si es dona de baixa: l'entrada sobreviu i
  -- només l'admin la pot editar (el mateix criteri que la 0079).
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (length(btrim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_followups_client_idx
  on public.clinical_followups (client_id, created_at desc);

comment on table public.clinical_followups is
  'Historial clínic: entrades de «Seguiment» (0110). Les crea l''admin o un fisio; cadascuna l''edita el seu autor o l''admin; esborra l''admin.';

-- Fins quan ha vist cadascú l'historial de cada client (avís de novetat).
create table if not exists public.clinical_seen (
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  seen_at    timestamptz not null default now(),
  primary key (viewer_id, client_id)
);

comment on table public.clinical_seen is
  'Fins quan ha vist cadascú l''historial clínic d''un client (0110). L''entrenador assignat hi veu una novetat si hi ha res més nou d''un altre.';

-- ─── 3. El que no es pot canviar en editar ───────────────────────────────────
--
-- La RLS no sap restringir per columna. Editar vol dir canviar el TEXT: el
-- client, l'autor i les dates de creació es queden com eren, i la data
-- d'edició (i qui ho ha fet) la posa la base.

create or replace function public.clinical_first_visit_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.updated_by := new.created_by;
  else
    new.client_id  := old.client_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists clinical_first_visits_touch on public.clinical_first_visits;
create trigger clinical_first_visits_touch
  before insert or update on public.clinical_first_visits
  for each row execute function public.clinical_first_visit_touch();

create or replace function public.clinical_followup_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.client_id  := old.client_id;
    new.author_id  := old.author_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists clinical_followups_touch on public.clinical_followups;
create trigger clinical_followups_touch
  before insert or update on public.clinical_followups
  for each row execute function public.clinical_followup_touch();

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

alter table public.clinical_first_visits enable row level security;
alter table public.clinical_followups    enable row level security;
alter table public.clinical_seen         enable row level security;

-- Ningú anònim; la resta la decideix la RLS.
revoke all on public.clinical_first_visits from anon;
revoke all on public.clinical_followups    from anon;
revoke all on public.clinical_seen         from anon;
grant select, insert, update, delete on public.clinical_first_visits to authenticated;
grant select, insert, update, delete on public.clinical_followups    to authenticated;
grant select, insert, update          on public.clinical_seen         to authenticated;

-- Primera visita ---------------------------------------------------------------

drop policy if exists "clinical_first_visits_select" on public.clinical_first_visits;
create policy "clinical_first_visits_select" on public.clinical_first_visits
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      (public.is_physio() or public.is_trainer_of(client_id))
      and public.same_world(client_id)
    )
  );

drop policy if exists "clinical_first_visits_insert" on public.clinical_first_visits;
create policy "clinical_first_visits_insert" on public.clinical_first_visits
  for insert to authenticated
  with check (
    (
      coalesce(public.is_admin(), false)
      or (public.is_physio() and public.same_world(client_id))
    )
    and created_by = auth.uid()
  );

drop policy if exists "clinical_first_visits_update" on public.clinical_first_visits;
create policy "clinical_first_visits_update" on public.clinical_first_visits
  for update to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (public.is_physio() and public.same_world(client_id))
  )
  with check (
    coalesce(public.is_admin(), false)
    or (public.is_physio() and public.same_world(client_id))
  );

drop policy if exists "clinical_first_visits_delete" on public.clinical_first_visits;
create policy "clinical_first_visits_delete" on public.clinical_first_visits
  for delete to authenticated
  using (coalesce(public.is_admin(), false));

-- Seguiment --------------------------------------------------------------------

drop policy if exists "clinical_followups_select" on public.clinical_followups;
create policy "clinical_followups_select" on public.clinical_followups
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      (public.is_physio() or public.is_trainer_of(client_id))
      and public.same_world(client_id)
    )
  );

-- Crear, signant amb el seu nom: sense `author_id = auth.uid()` es podria
-- desar una entrada firmada per un altre.
drop policy if exists "clinical_followups_insert" on public.clinical_followups;
create policy "clinical_followups_insert" on public.clinical_followups
  for insert to authenticated
  with check (
    (
      coalesce(public.is_admin(), false)
      or (public.is_physio() and public.same_world(client_id))
    )
    and author_id = auth.uid()
  );

-- Editar: l'admin, o el fisio que la va escriure.
drop policy if exists "clinical_followups_update" on public.clinical_followups;
create policy "clinical_followups_update" on public.clinical_followups
  for update to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (public.is_physio() and author_id = auth.uid() and public.same_world(client_id))
  )
  with check (
    coalesce(public.is_admin(), false)
    or (public.is_physio() and author_id = auth.uid() and public.same_world(client_id))
  );

drop policy if exists "clinical_followups_delete" on public.clinical_followups;
create policy "clinical_followups_delete" on public.clinical_followups
  for delete to authenticated
  using (coalesce(public.is_admin(), false));

-- Vist --------------------------------------------------------------------------
-- Cadascú, només les seves files, i només d'un historial que pot llegir.

drop policy if exists "clinical_seen_select" on public.clinical_seen;
create policy "clinical_seen_select" on public.clinical_seen
  for select to authenticated
  using (viewer_id = auth.uid());

drop policy if exists "clinical_seen_insert" on public.clinical_seen;
create policy "clinical_seen_insert" on public.clinical_seen
  for insert to authenticated
  with check (
    viewer_id = auth.uid()
    and (
      coalesce(public.is_admin(), false)
      or (
        (public.is_physio() or public.is_trainer_of(client_id))
        and public.same_world(client_id)
      )
    )
  );

drop policy if exists "clinical_seen_update" on public.clinical_seen;
create policy "clinical_seen_update" on public.clinical_seen
  for update to authenticated
  using (viewer_id = auth.uid())
  with check (viewer_id = auth.uid());

-- ─── 5. Consentiment de salut: signat sí/no i quan ───────────────────────────
--
-- El fisio i l'entrenador assignat no llegeixen `consents` (0014): hi ha la IP
-- i el de privacitat, que no els calen. Aquesta funció només diu si hi ha el de
-- dades de salut, quina versió i quan, i només a qui pot llegir l'historial
-- d'aquell client. A qualsevol altre, cap fila.

create or replace function public.health_consent_status(p_client uuid)
returns table (granted_at timestamptz, version text)
language sql
stable
security definer
set search_path = public
as $$
  select c.granted_at, c.version
  from public.consents c
  join public.clients cl on cl.profile_id = c.user_id
  where cl.id = p_client
    and c.type = 'health_data'
    and (
      coalesce(public.is_admin(), false)
      or (
        (public.is_physio() or public.is_trainer_of(p_client))
        and public.same_world(p_client)
      )
    )
  order by c.granted_at desc
  limit 1
$$;

comment on function public.health_consent_status(uuid) is
  'Consentiment de dades de salut d''un client: data i versió del més recent, o cap fila. Només per a qui pot llegir el seu historial clínic (0110).';

revoke execute on function public.health_consent_status(uuid) from public;
revoke execute on function public.health_consent_status(uuid) from anon;
grant  execute on function public.health_consent_status(uuid) to authenticated;

-- ─── 6. Registre d'accessos ──────────────────────────────────────────────────

alter table public.data_access_log
  drop constraint if exists data_access_log_action_check;
alter table public.data_access_log
  add constraint data_access_log_action_check
  check (action in ('export', 'delete', 'clinical_view'));

-- ─── 7. Còpia de les notes clíniques d'abans ─────────────────────────────────
--
-- Sense autor (no se sap qui les va escriure). Si un client ja té primera
-- visita, no es trepitja.

insert into public.clinical_first_visits (client_id, body, created_by)
select c.id, c.clinical_notes, null
from public.clients c
where nullif(btrim(c.clinical_notes), '') is not null
on conflict (client_id) do nothing;
