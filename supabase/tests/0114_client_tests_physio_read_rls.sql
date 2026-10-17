-- ============================================================================
-- VindiBCN · proves de RLS de la 0114 (els fisios llegeixen els tests)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0114. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit.
--
-- Només comptes DEMO. El test de prova es crea com a postgres al Client Demo,
-- que dins de la transacció té l'Entrenador Demo com a professional assignat:
-- el Fisio Demo NO n'és l'assignat. Tots els recomptes miren només aquest test
-- (per id), així no compten els que ja hi hagi.
--
-- `same_world` sense cap compte real: al final es treu el Fisio Demo de
-- `demo_profiles` DINS de la transacció. Passa a ser «real» i ha de deixar de
-- veure el Client Demo.
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

-- Preparació, com a postgres ------------------------------------------------
do $$
declare
  v_client uuid;
  v_test uuid;
  v_entry uuid;
begin
  select id into v_client from public.clients
   where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  if v_client is null then
    raise exception 'No trobo el client del Client Demo';
  end if;
  update public.clients
     set assigned_trainer_id = '5119e112-74af-4c85-862b-829f6d726ea2'
   where id = v_client;

  insert into public.client_tests (client_id, title, unit, better_when)
  values (v_client, 'Prova 0114', 'reps', 'up')
  returning id into v_test;
  insert into public.client_test_entries (test_id, value, measured_on)
  values (v_test, 5, current_date - 7);
  insert into public.client_test_entries (test_id, value)
  values (v_test, 7)
  returning id into v_entry;

  perform set_config('t.client', v_client::text, true);
  perform set_config('t.test', v_test::text, true);
  perform set_config('t.entry', v_entry::text, true);
end $$;

-- Qui és fisio ----------------------------------------------------------------
do $$
declare v text;
begin
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  insert into r (cas, esperat, obtingut) values ('Fisio Demo: is_physio()', 'true', public.is_physio()::text);
  perform pg_temp.prou();
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  insert into r (cas, esperat, obtingut) values ('Entrenador Demo: is_physio()', 'false', public.is_physio()::text);
  perform pg_temp.prou();
end $$;

-- Fisio Demo (no assignat): llegeix, no escriu --------------------------------
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t uuid := current_setting('t.test')::uuid;
  e uuid := current_setting('t.entry')::uuid;
  v text; n int;
begin
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  insert into r (cas, esperat, obtingut) values ('auth.uid() = Fisio Demo', '1c36928b…', left(auth.uid()::text, 8) || '…');

  select count(*) into n from public.client_tests where id = t;
  insert into r (cas, esperat, obtingut) values ('FIS llegeix el test', '1', n::text);
  select count(*) into n from public.client_test_entries where test_id = t;
  insert into r (cas, esperat, obtingut) values ('FIS llegeix els registres', '2', n::text);

  begin
    insert into public.client_tests (client_id, title) values (c, 'Goniometria 0114');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('FIS crea test', '42501', v);

  begin
    insert into public.client_test_entries (test_id, value) values (t, 9);
    v := 'ok';
  exception when others then v := sqlstate; end;
  -- Ara SÍ que veu el test: el trigger en troba el client i decideix la RLS.
  insert into r (cas, esperat, obtingut) values ('FIS crea registre', '42501', v);

  update public.client_tests set title = 'Canviat' where id = t;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('FIS edita test (files)', '0', n::text);

  update public.client_test_entries set value = 99 where id = e;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('FIS edita registre (files)', '0', n::text);

  delete from public.client_test_entries where id = e;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('FIS esborra registre (files)', '0', n::text);

  delete from public.client_tests where id = t;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('FIS esborra test (files)', '0', n::text);

  begin
    perform public.reorder_client_tests(c, (select array_agg(id order by position desc) from public.client_tests where client_id = c));
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('FIS reordena', '42501', v);

  perform pg_temp.prou();
end $$;

-- Entrenador Demo (assignat): com abans ---------------------------------------
do $$
declare
  t uuid := current_setting('t.test')::uuid;
  e uuid := current_setting('t.entry')::uuid;
  v text; n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  select count(*) into n from public.client_test_entries where test_id = t;
  insert into r (cas, esperat, obtingut) values ('ENT assignat llegeix els registres', '2', n::text);
  begin
    insert into public.client_test_entries (test_id, value) values (t, 8);
    v := 'ok';
  exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('ENT assignat crea registre', 'ok', v);
  update public.client_test_entries set value = 7.5 where id = e;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('ENT assignat edita registre (files)', '1', n::text);
  perform pg_temp.prou();
end $$;

-- Client Demo: llegeix, no escriu ----------------------------------------------
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t uuid := current_setting('t.test')::uuid;
  e uuid := current_setting('t.entry')::uuid;
  v text; n int;
begin
  perform pg_temp.com('d3b42dcb-7c11-4431-abc0-723b21add106');
  select count(*) into n from public.client_test_entries where test_id = t;
  insert into r (cas, esperat, obtingut) values ('CLI llegeix els seus registres', '3', n::text);
  begin
    insert into public.client_tests (client_id, title) values (c, 'Planxa 0114');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('CLI crea test', '42501', v);
  update public.client_test_entries set value = 1 where id = e;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('CLI edita registre (files)', '0', n::text);
  perform pg_temp.prou();
end $$;

-- Un entrenador que NO és fisio i ja no és l'assignat: res -----------------------
-- (la política nova no obre la lectura a tots els professionals)
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t uuid := current_setting('t.test')::uuid;
  n int;
begin
  update public.clients set assigned_trainer_id = null where id = c;
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  select count(*) into n from public.client_tests where id = t;
  insert into r (cas, esperat, obtingut) values ('ENT no assignat llegeix el test', '0', n::text);
  select count(*) into n from public.client_test_entries where test_id = t;
  insert into r (cas, esperat, obtingut) values ('ENT no assignat llegeix els registres', '0', n::text);
  perform pg_temp.prou();
end $$;

-- same_world: el Fisio Demo passa a «real» (només aquí dins) ---------------------
do $$
declare
  t uuid := current_setting('t.test')::uuid;
  n int;
begin
  delete from public.demo_profiles where profile_id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  select count(*) into n from public.client_tests where id = t;
  insert into r (cas, esperat, obtingut) values ('MÓN: fisio d''un altre món llegeix el test', '0', n::text);
  select count(*) into n from public.client_test_entries where test_id = t;
  insert into r (cas, esperat, obtingut) values ('MÓN: fisio d''un altre món llegeix els registres', '0', n::text);
  perform pg_temp.prou();
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
