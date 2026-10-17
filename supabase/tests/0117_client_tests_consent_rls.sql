-- ============================================================================
-- VindiBCN · proves de RLS de la 0117 (crear tests demana el consentiment)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0117. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit.
--
-- Només comptes DEMO. Dins de la transacció, com a postgres:
--   · el Client Demo té l'Entrenador Demo com a professional assignat;
--   · hi ha un test i un registre de prova (creats com a postgres);
--   · el consentiment de salut del Client Demo s'ESBORRA (fase «sense») i
--     després se n'hi POSA un (fase «amb»);
--   · per provar l'ADMIN sense la compte real, l'Entrenador Demo passa a ser
--     admin un moment (el trigger del rol ho deixa fer a postgres sense sessió)
--     i torna a ser professional;
--   · per provar «demo amb demo», al final es treu l'Entrenador Demo de
--     `demo_profiles`.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;

create function pg_temp.com(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.prou() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Una tanda de proves amb una sessió: llegir, crear test, crear registre,
-- editar test, editar registre. `esperats` = resultats esperats en aquest ordre.
create function pg_temp.tanda(etiqueta text, qui uuid, esperats text[]) returns void language plpgsql as $$
declare
  c uuid := current_setting('t.client')::uuid;
  t uuid := current_setting('t.test')::uuid;
  e uuid := current_setting('t.entry')::uuid;
  v text; n int;
begin
  perform pg_temp.com(qui);

  select count(*) into n from public.client_tests where id = t;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': llegeix el test', esperats[1], n::text);

  begin
    insert into public.client_tests (client_id, title) values (c, 'Prova 0117 ' || etiqueta);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': crea test', esperats[2], v);

  begin
    insert into public.client_test_entries (test_id, value) values (t, 42);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': crea registre', esperats[3], v);

  update public.client_tests set description = 'editat ' || etiqueta where id = t;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': edita el test (files)', esperats[4], n::text);

  update public.client_test_entries set notes = 'editat ' || etiqueta where id = e;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': edita el registre (files)', esperats[5], n::text);

  perform pg_temp.prou();
end $$;

-- Preparació, com a postgres -----------------------------------------------------
do $$
declare
  c uuid;
  t uuid;
  e uuid;
begin
  select id into c from public.clients where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  if c is null then raise exception 'No trobo el client del Client Demo'; end if;
  update public.clients set assigned_trainer_id = '5119e112-74af-4c85-862b-829f6d726ea2' where id = c;

  insert into public.client_tests (client_id, title, unit) values (c, 'Prova 0117', 'reps') returning id into t;
  insert into public.client_test_entries (test_id, value) values (t, 10) returning id into e;

  perform set_config('t.client', c::text, true);
  perform set_config('t.test', t::text, true);
  perform set_config('t.entry', e::text, true);

  -- Fase «sense»: el Client Demo sense consentiment de salut.
  delete from public.consents
   where user_id = 'd3b42dcb-7c11-4431-abc0-723b21add106' and type = 'health_data';
end $$;

-- ─── SENSE consentiment ───────────────────────────────────────────────────────
-- Esperats: llegeix · crea test · crea registre · edita test · edita registre
select pg_temp.tanda('SENSE · Entrenador assignat', '5119e112-74af-4c85-862b-829f6d726ea2', array['1', '42501', '42501', '1', '1']);
select pg_temp.tanda('SENSE · Fisio (no assignat)', '1c36928b-0668-4377-a5d8-c7befb2d78bc', array['1', '42501', '42501', '0', '0']);
select pg_temp.tanda('SENSE · Client',              'd3b42dcb-7c11-4431-abc0-723b21add106', array['1', '42501', '42501', '0', '0']);

update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
select pg_temp.tanda('SENSE · Admin',               '5119e112-74af-4c85-862b-829f6d726ea2', array['1', '42501', '42501', '1', '1']);
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';

-- Esborrar el que ja hi ha segueix igual sense consentiment.
do $$
declare n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  delete from public.client_test_entries where id = current_setting('t.entry')::uuid;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('SENSE · Entrenador assignat: esborra el registre (files)', '1', n::text);
  perform pg_temp.prou();
end $$;

-- ─── AMB consentiment ─────────────────────────────────────────────────────────
do $$
declare e uuid;
begin
  insert into public.consents (user_id, type, version)
  values ('d3b42dcb-7c11-4431-abc0-723b21add106', 'health_data', '2026-06');
  -- Un registre nou per a les edicions (l'altre s'ha esborrat).
  insert into public.client_test_entries (test_id, value) values (current_setting('t.test')::uuid, 11) returning id into e;
  perform set_config('t.entry', e::text, true);
end $$;

select pg_temp.tanda('AMB · Entrenador assignat', '5119e112-74af-4c85-862b-829f6d726ea2', array['1', 'ok', 'ok', '1', '1']);
select pg_temp.tanda('AMB · Fisio (no assignat)', '1c36928b-0668-4377-a5d8-c7befb2d78bc', array['1', '42501', '42501', '0', '0']);
select pg_temp.tanda('AMB · Client',              'd3b42dcb-7c11-4431-abc0-723b21add106', array['1', '42501', '42501', '0', '0']);

update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
select pg_temp.tanda('AMB · Admin',               '5119e112-74af-4c85-862b-829f6d726ea2', array['1', 'ok', 'ok', '1', '1']);
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';

-- ─── Demo amb demo: l'Entrenador Demo passa a «real» (amb consentiment) ────────
delete from public.demo_profiles where profile_id = '5119e112-74af-4c85-862b-829f6d726ea2';
select pg_temp.tanda('MÓN · Entrenador d''un altre món', '5119e112-74af-4c85-862b-829f6d726ea2', array['0', '42501', '42501', '0', '0']);

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
