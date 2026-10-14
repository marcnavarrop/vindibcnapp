-- ============================================================================
-- VindiBCN · 0112 — Els exercicis assignats, organitzats per dies
--
-- Tiquet d'en Raul i decisions d'en Marc (15/10/2026). Fins ara els exercicis
-- d'un client eren una sola llista (`client_exercises`, 0012). Ara:
--
--   · DIES per client (`client_workout_days`): «Dia 1, 2, 3…» en cicle (no
--     lligats a dies de la setmana), amb un nom opcional («Cames», «Tors»).
--     Es creen, es reanomenen, es reordenen, es dupliquen (amb els exercicis i
--     la pauta) i s'esborren. En esborrar-ne un, els seus exercicis passen a
--     «Sense dia» (`day_id` nul): MAI s'esborren.
--   · Cada exercici assignat té DIA (`day_id`, nul = «Sense dia») i ORDRE
--     (`position`) dins del dia, i una PAUTA opcional: sèries, repeticions o
--     temps, càrrega i descans. Un mateix exercici pot ser a diversos dies
--     (ja ho podia ser: la 0012 no té cap restricció única).
--   · «DIA FET» (`client_workout_logs`): el client marca que ha fet el dia,
--     amb data d'avui; el pot desmarcar el mateix dia. El professional en veu
--     l'última vegada i l'historial recent.
--
-- EL PROGRÉS NO ES PERD MAI
--
-- `exercise_progress` penja de l'assignació (`client_exercise_id`, amb
-- `on delete cascade`). Per això moure un exercici de dia és un UPDATE del seu
-- `day_id` (`move_client_exercise`), mai esborrar l'assignació i crear-ne una
-- altra. I esborrar un dia fa `on delete set null` sobre `day_id`: l'assignació
-- es queda, i el seu progrés amb ella.
--
-- QUI HI ARRIBA
--
--                         dies i pauta             «dia fet»
--   admin                 llegir i escriure tot    llegir; esborrar
--   professional ASSIGNAT llegir i escriure        llegir
--   altres professionals  res                      res
--   el client dueny       llegir                   llegir; marcar AVUI;
--                                                  desmarcar el d'AVUI
--   altres clients        res                      res
--
-- És el patró de `client_exercises` (0012) amb `same_world` (0110) a sobre:
-- un professional o un client demo no creua mai amb un de real, i a l'inrevés.
-- L'admin ho veu tot. Les polítiques de `client_exercises` no es toquen: les
-- columnes noves hi viuen amb les de sempre.
--
-- PER QUÈ UN TRIGGER I NO UNA CLAU FORÀNEA COMPOSTA
--
-- «El dia és del mateix client que l'exercici» es podria escriure com a clau
-- forània (day_id, client_id) → (id, client_id), però llavors l'`on delete set
-- null` posaria a nul també `client_id`, que no pot ser-ho; triar només una
-- columna (`set null (day_id)`) demana Postgres 15. Un trigger diu el mateix
-- en tres línies i no depèn de la versió.
--
-- ELS JA ASSIGNATS
--
-- Es queden a «Sense dia» i s'ordenen per data d'assignació. L'app només
-- ensenya «Sense dia» si hi ha alguna cosa.
-- ============================================================================

-- Dies -------------------------------------------------------------------------

create table if not exists public.client_workout_days (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  -- Ordre dins del cicle. El número que es veu («Dia 2») surt de l'ORDRE, no
  -- d'aquest valor: en esborrar un dia, els de després es tornen a numerar sols.
  position   int  not null,
  -- Opcional. Sense nom, l'app diu «Dia N» (en l'idioma de qui mira).
  name       text check (name is null or char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  constraint client_workout_days_position_key
    unique (client_id, position) deferrable initially deferred
);

comment on table public.client_workout_days is
  'Dies de la pauta d''un client (Dia 1, 2, 3… en cicle, amb nom opcional). 0112.';

alter table public.client_workout_days enable row level security;

-- Exercicis assignats: dia, ordre i pauta --------------------------------------

alter table public.client_exercises
  add column if not exists day_id       uuid references public.client_workout_days (id) on delete set null,
  add column if not exists position     int,
  add column if not exists sets         smallint check (sets is null or sets between 1 and 99),
  add column if not exists reps         text check (reps is null or char_length(reps) between 1 and 20),
  add column if not exists load         text check (load is null or char_length(load) between 1 and 30),
  add column if not exists rest_seconds smallint check (rest_seconds is null or rest_seconds between 0 and 3600);

comment on column public.client_exercises.day_id is
  'Dia de la pauta (0112). Nul = «Sense dia». Esborrar el dia el posa a nul: l''exercici i el seu progrés es queden.';
comment on column public.client_exercises.reps is
  'Repeticions o temps, en text curt: «10», «8-10», «30 s». 0112.';
comment on column public.client_exercises.load is
  'Càrrega, en text curt: «20 kg», «RPE 7». 0112.';

-- Els ja assignats: a «Sense dia», en ordre d'assignació (10, 20, 30…).
update public.client_exercises ce
   set position = s.rn
  from (
    select id, (row_number() over (partition by client_id order by assigned_at, id)) * 10 as rn
    from public.client_exercises
  ) s
 where s.id = ce.id
   and ce.position is null;

create index if not exists idx_client_exercises_day
  on public.client_exercises (client_id, day_id, position);

-- El dia ha de ser del mateix client, i un exercici nou va al final del seu dia.
create or replace function public.client_exercises_day_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.day_id is not null and not exists (
    select 1 from public.client_workout_days d
    where d.id = new.day_id and d.client_id = new.client_id
  ) then
    raise exception 'Aquest dia no és d''aquest client.' using errcode = '23514';
  end if;

  if new.position is null then
    select coalesce(max(ce.position), 0) + 10
      into new.position
      from public.client_exercises ce
     where ce.client_id = new.client_id
       and ce.day_id is not distinct from new.day_id;
  end if;

  return new;
end;
$$;

drop trigger if exists client_exercises_day_guard on public.client_exercises;
create trigger client_exercises_day_guard
  before insert or update of day_id, client_id, position on public.client_exercises
  for each row execute function public.client_exercises_day_guard();

-- A partir d'aquí, mai sense ordre (el trigger l'omple si no ve).
alter table public.client_exercises alter column position set not null;

-- «Dia fet» ----------------------------------------------------------------------

create table if not exists public.client_workout_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  -- Si s'esborra el dia, el registre es queda (és història) amb la foto de
  -- sota: com es deia i quin número tenia.
  day_id      uuid references public.client_workout_days (id) on delete set null,
  day_name    text,
  day_number  int  not null,
  done_on     date not null default ((now() at time zone 'Europe/Madrid')::date),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint client_workout_logs_day_once unique (day_id, done_on)
);

comment on table public.client_workout_logs is
  '«Dia fet»: el client marca que ha fet un dia de la pauta, amb data d''avui (Europe/Madrid). 0112.';

create index if not exists idx_client_workout_logs_client
  on public.client_workout_logs (client_id, done_on desc);

alter table public.client_workout_logs enable row level security;

-- La foto del dia (nom i número) la posa la base, no qui marca.
create or replace function public.client_workout_logs_fill()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d public.client_workout_days;
begin
  select * into d from public.client_workout_days where id = new.day_id;
  if d.id is null or d.client_id <> new.client_id then
    raise exception 'Aquest dia no és d''aquest client.' using errcode = '23514';
  end if;
  new.day_name := d.name;
  new.day_number := (
    select count(*) from public.client_workout_days x
    where x.client_id = d.client_id and x.position <= d.position
  );
  return new;
end;
$$;

drop trigger if exists client_workout_logs_fill on public.client_workout_logs;
create trigger client_workout_logs_fill
  before insert on public.client_workout_logs
  for each row execute function public.client_workout_logs_fill();

-- Permisos de taula ----------------------------------------------------------------

revoke all on public.client_workout_days from anon;
revoke all on public.client_workout_logs from anon;
grant select, insert, update, delete on public.client_workout_days to authenticated;
grant select, insert, delete          on public.client_workout_logs to authenticated;

-- Polítiques: dies ---------------------------------------------------------------

drop policy if exists "client_workout_days_select" on public.client_workout_days;
create policy "client_workout_days_select" on public.client_workout_days
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      (public.owns_client(client_id) or public.is_trainer_of(client_id))
      and public.same_world(client_id)
    )
  );

drop policy if exists "client_workout_days_write" on public.client_workout_days;
create policy "client_workout_days_write" on public.client_workout_days
  for all to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (public.is_trainer_of(client_id) and public.same_world(client_id))
  )
  with check (
    coalesce(public.is_admin(), false)
    or (public.is_trainer_of(client_id) and public.same_world(client_id))
  );

-- Polítiques: «dia fet» ------------------------------------------------------------

drop policy if exists "client_workout_logs_select" on public.client_workout_logs;
create policy "client_workout_logs_select" on public.client_workout_logs
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      (public.owns_client(client_id) or public.is_trainer_of(client_id))
      and public.same_world(client_id)
    )
  );

-- Només el client, per a ell mateix, amb data d'avui i signant amb el seu nom.
drop policy if exists "client_workout_logs_insert" on public.client_workout_logs;
create policy "client_workout_logs_insert" on public.client_workout_logs
  for insert to authenticated
  with check (
    public.owns_client(client_id)
    and public.same_world(client_id)
    and created_by = auth.uid()
    and done_on = (now() at time zone 'Europe/Madrid')::date
  );

-- Desmarcar: el client, el seu d'avui. L'admin, qualsevol (per netejar).
drop policy if exists "client_workout_logs_delete" on public.client_workout_logs;
create policy "client_workout_logs_delete" on public.client_workout_logs
  for delete to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (
      public.owns_client(client_id)
      and public.same_world(client_id)
      and done_on = (now() at time zone 'Europe/Madrid')::date
    )
  );

-- Funcions -----------------------------------------------------------------------
--
-- Totes SECURITY INVOKER: corren amb la sessió de qui crida, i la RLS de sobre
-- decideix. Si qui crida no pot veure o tocar alguna fila, la funció no la
-- troba, el recompte no quadra i s'atura sense canviar res.

-- Un dia nou, al final del cicle.
create or replace function public.create_client_workout_day(p_client uuid, p_name text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.client_workout_days (client_id, position, name)
  values (
    p_client,
    coalesce((select max(position) from public.client_workout_days where client_id = p_client), 0) + 1,
    nullif(btrim(p_name), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Reordenar els dies: `p_ids` ha de ser EXACTAMENT el conjunt de dies del client.
create or replace function public.reorder_client_workout_days(p_client uuid, p_ids uuid[])
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
     or cardinality(p_ids) <> (select count(*) from public.client_workout_days where client_id = p_client)
     or exists (
       select 1 from unnest(p_ids) x
       where not exists (
         select 1 from public.client_workout_days d where d.id = x and d.client_id = p_client
       )
     )
  then
    raise exception 'La llista de dies no quadra amb els dies del client.' using errcode = '22023';
  end if;

  update public.client_workout_days d
     set position = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
   where d.id = o.id and d.client_id = p_client;
  get diagnostics v_n = row_count;
  if v_n <> cardinality(p_ids) then
    raise exception 'No tens permís per reordenar aquests dies.' using errcode = '42501';
  end if;
end;
$$;

-- Reordenar els exercicis d'un dia (o de «Sense dia», amb `p_day` nul).
create or replace function public.reorder_client_exercises(p_client uuid, p_day uuid, p_ids uuid[])
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
     or cardinality(p_ids) <> (
       select count(*) from public.client_exercises
       where client_id = p_client and day_id is not distinct from p_day
     )
     or exists (
       select 1 from unnest(p_ids) x
       where not exists (
         select 1 from public.client_exercises ce
         where ce.id = x and ce.client_id = p_client and ce.day_id is not distinct from p_day
       )
     )
  then
    raise exception 'La llista d''exercicis no quadra amb els del dia.' using errcode = '22023';
  end if;

  update public.client_exercises ce
     set position = o.ord * 10
    from unnest(p_ids) with ordinality as o(id, ord)
   where ce.id = o.id;
  get diagnostics v_n = row_count;
  if v_n <> cardinality(p_ids) then
    raise exception 'No tens permís per reordenar aquests exercicis.' using errcode = '42501';
  end if;
end;
$$;

-- Moure un exercici a un altre dia (o a «Sense dia»), al final. És un UPDATE:
-- l'assignació és la mateixa i el seu progrés també.
create or replace function public.move_client_exercise(p_id uuid, p_day uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_client uuid;
  v_n int;
begin
  select client_id into v_client from public.client_exercises where id = p_id;
  if v_client is null then
    raise exception 'Aquest exercici ja no existeix.' using errcode = 'P0002';
  end if;

  update public.client_exercises
     set day_id = p_day,
         position = coalesce((
           select max(position) from public.client_exercises
           where client_id = v_client and day_id is not distinct from p_day and id <> p_id
         ), 0) + 10
   where id = p_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'No tens permís per moure aquest exercici.' using errcode = '42501';
  end if;
end;
$$;

-- Duplicar un dia: un dia nou al final, amb els mateixos exercicis, pauta,
-- notes i ordre. El progrés NO es copia: és de les assignacions d'origen.
create or replace function public.duplicate_client_workout_day(p_day uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  d public.client_workout_days;
  v_new uuid;
begin
  select * into d from public.client_workout_days where id = p_day;
  if d.id is null then
    raise exception 'Aquest dia ja no existeix.' using errcode = 'P0002';
  end if;

  insert into public.client_workout_days (client_id, position, name)
  values (
    d.client_id,
    (select max(position) from public.client_workout_days where client_id = d.client_id) + 1,
    case when d.name is null then null else left(d.name || ' (còpia)', 40) end
  )
  returning id into v_new;

  insert into public.client_exercises
    (client_id, exercise_id, assigned_by, notes, day_id, position, sets, reps, load, rest_seconds)
  select ce.client_id, ce.exercise_id, auth.uid(), ce.notes, v_new, ce.position,
         ce.sets, ce.reps, ce.load, ce.rest_seconds
    from public.client_exercises ce
   where ce.day_id = p_day
   order by ce.position;

  return v_new;
end;
$$;

revoke execute on function public.create_client_workout_day(uuid, text)     from public, anon;
revoke execute on function public.reorder_client_workout_days(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_client_exercises(uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.move_client_exercise(uuid, uuid)          from public, anon;
revoke execute on function public.duplicate_client_workout_day(uuid)        from public, anon;
grant  execute on function public.create_client_workout_day(uuid, text)     to authenticated;
grant  execute on function public.reorder_client_workout_days(uuid, uuid[]) to authenticated;
grant  execute on function public.reorder_client_exercises(uuid, uuid, uuid[]) to authenticated;
grant  execute on function public.move_client_exercise(uuid, uuid)          to authenticated;
grant  execute on function public.duplicate_client_workout_day(uuid)        to authenticated;
