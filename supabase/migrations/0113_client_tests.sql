-- ============================================================================
-- VindiBCN · 0113 — Tests d'avaluació per client
--
-- Tiquet d'en Raul («Tests d'avaluació») i decisions d'en Marc (15/10/2026).
-- A la fitxa del client, una pestanya «Tests»: cada test és un apartat propi
-- (títol lliure, unitat, descripció) on es van afegint registres (data, valor,
-- observació). Tants tests com calgui per client, cadascun amb la seva gràfica.
-- No hi ha catàleg: el test és del client.
--
--   · `client_tests`: el test. Títol (únic dins del client, sense distingir
--     majúscules), unitat opcional («reps», «cm», «s»), descripció opcional,
--     «millor si puja / baixa / neutre» (`better_when`) i ordre (`position`).
--   · `client_test_entries`: els registres. UN valor numèric (amb decimals) i
--     una observació opcional. Esquerra/dreta = dos tests.
--
-- QUI HI ARRIBA
--
--                         tests i registres
--   admin                 llegir i escriure tot
--   professional ASSIGNAT llegir i escriure
--   altres professionals  res (el fisio transversal tampoc: vegeu sota)
--   el client dueny       llegir
--   altres clients        res
--
-- És el patró d'`exercise_progress` (0029) amb `same_world` (0110) a sobre: un
-- professional o un client demo no creua mai amb un de real. «Professional
-- assignat» és `is_trainer_of` (`clients.assigned_trainer_id`): un fisio hi
-- escriu si és el professional assignat d'aquell client, com passa avui amb el
-- progrés dels exercicis.
--
-- TOTA LA REGLA EN DUES FUNCIONS
--
-- Les polítiques no diuen qui pot: ho pregunten a `client_tests_can_read` i
-- `client_tests_can_write`. Avui els tractem com el progrés dels exercicis (no
-- com a dades de salut). Si l'assessor diu que ho són, el canvi és un
-- `create or replace` d'aquestes dues funcions (i de la de suggeriments), sense
-- tocar taules ni polítiques. Si només ho són ALGUNS tests (perímetre sí,
-- dominades no), caldria a més una columna `is_health` a `client_tests` i
-- passar-la a les funcions.
--
-- SUGGERIMENTS DE TÍTOL
--
-- Un professional només veu els tests dels seus clients, però en escriure el
-- títol se li suggereixen els que ja es fan servir al centre (amb la unitat),
-- per no acabar amb «Dominades» i «dominadas». `client_test_suggestions()`
-- només torna títol, unitat i quantes vegades: cap client, cap valor. I només
-- del mateix món (demo amb demo).
--
-- Idempotent: `if not exists`, `create or replace`, `drop … if exists`.
-- ============================================================================

-- ─── 1. Taules ───────────────────────────────────────────────────────────────

create table if not exists public.client_tests (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 60),
  unit        text check (unit is null or char_length(btrim(unit)) between 1 and 20),
  description text check (description is null or char_length(description) <= 1000),
  -- Pinta la diferència amb el registre anterior: verd si millora, vermell si
  -- empitjora, gris si és neutre o no ha canviat.
  better_when text not null default 'neutral'
              check (better_when in ('up', 'down', 'neutral')),
  -- Ordre a la pestanya. El posa el trigger si no ve (al final).
  position    int  not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Per a la clau forània composta dels registres (vegeu sota).
  constraint client_tests_id_client_key unique (id, client_id),
  constraint client_tests_position_key
    unique (client_id, position) deferrable initially deferred
);

comment on table public.client_tests is
  'Tests d''avaluació d''un client (títol lliure, unitat, descripció, sentit de millora). Sense catàleg. 0113.';
comment on column public.client_tests.better_when is
  'up = millor si puja, down = millor si baixa, neutral = sense color. 0113.';

-- Un títol per client, sense distingir majúscules ni espais dels extrems.
create unique index if not exists client_tests_client_title_key
  on public.client_tests (client_id, lower(btrim(title)));

create table if not exists public.client_test_entries (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null,
  -- Repetit aquí perquè la RLS no hagi de fer una subconsulta per fila. La
  -- clau forània composta garanteix que és el mateix client del test.
  client_id   uuid not null,
  measured_on date not null default ((now() at time zone 'Europe/Madrid')::date),
  value       numeric(12, 3) not null,
  notes       text check (notes is null or char_length(notes) <= 1000),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint client_test_entries_test_fkey
    foreign key (test_id, client_id)
    references public.client_tests (id, client_id) on delete cascade
);

comment on table public.client_test_entries is
  'Registres d''un test d''avaluació: data, un valor numèric i observació opcional. 0113.';

create index if not exists idx_client_tests_client
  on public.client_tests (client_id, position);
create index if not exists idx_client_test_entries_test
  on public.client_test_entries (test_id, measured_on desc, created_at desc);
create index if not exists idx_client_test_entries_client
  on public.client_test_entries (client_id);

-- ─── 2. El que no es pot canviar en editar ───────────────────────────────────
--
-- La RLS no restringeix per columna. Editar un test vol dir canviar-ne el
-- títol, la unitat, la descripció, el sentit o l'ordre; editar un registre, la
-- data, el valor o l'observació. El client, el test d'un registre, l'autor i
-- la data de creació es queden com eren; la base posa l'autor i les dates.

create or replace function public.client_tests_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if new.position is null then
      select coalesce(max(t.position), 0) + 1
        into new.position
        from public.client_tests t
       where t.client_id = new.client_id;
    end if;
  else
    new.client_id  := old.client_id;
    -- Només pot passar a nul: és l'`on delete set null` quan s'esborra el perfil.
    new.created_by := case when new.created_by is null then null else old.created_by end;
    new.created_at := old.created_at;
  end if;
  new.title := btrim(new.title);
  new.unit := nullif(btrim(new.unit), '');
  new.description := nullif(btrim(new.description), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists client_tests_touch on public.client_tests;
create trigger client_tests_touch
  before insert or update on public.client_tests
  for each row execute function public.client_tests_touch();

create or replace function public.client_test_entries_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    -- El client el diu el test, no qui escriu.
    select t.client_id into new.client_id
      from public.client_tests t where t.id = new.test_id;
  else
    new.test_id    := old.test_id;
    new.client_id  := old.client_id;
    -- Només pot passar a nul: és l'`on delete set null` quan s'esborra el perfil.
    new.created_by := case when new.created_by is null then null else old.created_by end;
    new.created_at := old.created_at;
  end if;
  if new.measured_on > (now() at time zone 'Europe/Madrid')::date then
    raise exception 'La data del registre no pot ser futura.' using errcode = '23514';
  end if;
  new.notes := nullif(btrim(new.notes), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists client_test_entries_touch on public.client_test_entries;
create trigger client_test_entries_touch
  before insert or update on public.client_test_entries
  for each row execute function public.client_test_entries_touch();

-- ─── 3. Qui pot: les dues funcions ───────────────────────────────────────────
--
-- SECURITY INVOKER: només combinen les de sempre (que ja són definer). Si
-- l'assessor diu que són dades de salut, es reescriuen aquí (vegeu la capçalera).

create or replace function public.client_tests_can_read(p_client uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(public.is_admin(), false)
      or (
        (public.owns_client(p_client) or public.is_trainer_of(p_client))
        and public.same_world(p_client)
      )
$$;

create or replace function public.client_tests_can_write(p_client uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(public.is_admin(), false)
      or (public.is_trainer_of(p_client) and public.same_world(p_client))
$$;

comment on function public.client_tests_can_read(uuid) is
  'Qui llegeix els tests d''avaluació d''un client (0113): admin, professional assignat i el mateix client, del mateix món.';
comment on function public.client_tests_can_write(uuid) is
  'Qui escriu els tests d''avaluació d''un client (0113): admin i professional assignat, del mateix món.';

revoke execute on function public.client_tests_can_read(uuid)  from public, anon;
revoke execute on function public.client_tests_can_write(uuid) from public, anon;
grant  execute on function public.client_tests_can_read(uuid)  to authenticated;
grant  execute on function public.client_tests_can_write(uuid) to authenticated;

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

alter table public.client_tests        enable row level security;
alter table public.client_test_entries enable row level security;

revoke all on public.client_tests        from anon;
revoke all on public.client_test_entries from anon;
grant select, insert, update, delete on public.client_tests        to authenticated;
grant select, insert, update, delete on public.client_test_entries to authenticated;

drop policy if exists "client_tests_select" on public.client_tests;
create policy "client_tests_select" on public.client_tests
  for select to authenticated
  using (public.client_tests_can_read(client_id));

drop policy if exists "client_tests_write" on public.client_tests;
create policy "client_tests_write" on public.client_tests
  for all to authenticated
  using (public.client_tests_can_write(client_id))
  with check (public.client_tests_can_write(client_id));

drop policy if exists "client_test_entries_select" on public.client_test_entries;
create policy "client_test_entries_select" on public.client_test_entries
  for select to authenticated
  using (public.client_tests_can_read(client_id));

drop policy if exists "client_test_entries_write" on public.client_test_entries;
create policy "client_test_entries_write" on public.client_test_entries
  for all to authenticated
  using (public.client_tests_can_write(client_id))
  with check (public.client_tests_can_write(client_id));

-- ─── 5. Funcions ─────────────────────────────────────────────────────────────

-- Reordenar els tests: `p_ids` ha de ser EXACTAMENT el conjunt de tests del
-- client. SECURITY INVOKER: si qui crida no els pot tocar tots, el recompte no
-- quadra i s'atura sense canviar res (el patró de la 0112).
create or replace function public.reorder_client_tests(p_client uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n int;
begin
  if p_ids is null
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or cardinality(p_ids) <> (select count(*) from public.client_tests where client_id = p_client)
     or exists (
       select 1 from unnest(p_ids) x
       where not exists (
         select 1 from public.client_tests t where t.id = x and t.client_id = p_client
       )
     )
  then
    raise exception 'La llista de tests no quadra amb els tests del client.' using errcode = '22023';
  end if;

  update public.client_tests t
     set position = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
   where t.id = o.id and t.client_id = p_client;
  get diagnostics v_n = row_count;
  if v_n <> cardinality(p_ids) then
    raise exception 'No tens permís per reordenar aquests tests.' using errcode = '42501';
  end if;
end;
$$;

-- Títols ja fets servir al centre, amb la unitat i quantes vegades. Només per
-- a l'admin i els professionals, i només del seu món. SECURITY DEFINER perquè
-- miri tots els clients, però no en torna cap: ni client, ni valor, ni data.
create or replace function public.client_test_suggestions()
returns table (title text, unit text, uses int)
language sql
stable
security definer
set search_path = public
as $$
  select mode() within group (order by t.title) as title,
         mode() within group (order by t.unit)  as unit,
         count(*)::int                           as uses
    from public.client_tests t
   where public.current_role() in ('admin', 'trainer')
     and public.same_world(t.client_id)
   group by lower(t.title), lower(coalesce(t.unit, ''))
   order by count(*) desc, 1
   limit 200
$$;

comment on function public.client_test_suggestions() is
  'Títols de test ja usats al centre (amb unitat i usos), per suggerir-los en crear-ne un. Admin i professionals, mateix món. 0113.';

revoke execute on function public.reorder_client_tests(uuid, uuid[]) from public, anon;
revoke execute on function public.client_test_suggestions()          from public, anon;
grant  execute on function public.reorder_client_tests(uuid, uuid[]) to authenticated;
grant  execute on function public.client_test_suggestions()          to authenticated;
