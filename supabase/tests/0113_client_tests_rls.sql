-- ============================================================================
-- VindiBCN · proves de RLS de la 0113 (tests d'avaluació)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0113. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit.
--
-- Només comptes DEMO (els de `demo_profiles`): Entrenador Demo, Fisio Demo i
-- Client Demo. Per provar `same_world` sense cap compte real, al final es treu
-- l'Entrenador Demo de `demo_profiles` DINS de la transacció: passa a ser «real»
-- i ha de deixar de veure el Client Demo encara que n'és l'assignat.
--
-- Una sola taula de resultats al final (cas, esperat, obtingut, ok). Cada cas
-- captura el seu error: el primer que falla no atura la resta.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;

-- Actuar com un perfil (claims + rol authenticated) i tornar a postgres.
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

-- Preparació, com a postgres: l'Entrenador Demo, assignat al Client Demo.
do $$
declare
  v_client uuid;
begin
  select id into v_client from public.clients
   where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  if v_client is null then
    raise exception 'No trobo el client del Client Demo';
  end if;
  perform set_config('t.client', v_client::text, true);
  update public.clients
     set assigned_trainer_id = '5119e112-74af-4c85-862b-829f6d726ea2'
   where id = v_client;
end $$;

-- ─── Entrenador Demo (assignat): crea, edita, reordena ─────────────────────
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t1 uuid; t2 uuid; e1 uuid; v text; n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  insert into r (cas, esperat, obtingut) values ('auth.uid() = Entrenador Demo', '5119e112…', left(auth.uid()::text, 8) || '…');

  begin
    insert into public.client_tests (client_id, title, unit, better_when)
    values (c, '  Dominades  ', 'reps', 'up') returning id into t1;
    insert into public.client_tests (client_id, title, unit, better_when)
    values (c, 'Perímetre abdominal', 'cm', 'down') returning id into t2;
    v := 'ok';
  exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('ENT crea 2 tests', 'ok', v);
  perform set_config('t.t1', t1::text, true);
  perform set_config('t.t2', t2::text, true);

  select title || '|' || position into v from public.client_tests where id = t1;
  insert into r (cas, esperat, obtingut) values ('ENT títol net i posició 1', 'Dominades|1', v);

  begin
    insert into public.client_test_entries (test_id, client_id, value, notes)
    values (t1, gen_random_uuid(), 8, 'amb goma') returning id into e1;
    select case when client_id = c then 'client del test' else 'ALTRE' end into v
      from public.client_test_entries where id = e1;
  exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('ENT registre (client_id fals ignorat)', 'client del test', v);
  perform set_config('t.e1', e1::text, true);

  begin
    insert into public.client_test_entries (test_id, value, measured_on)
    values (t1, 9.5, current_date - 7);
    v := 'ok';
  exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('ENT registre amb decimals', 'ok', v);

  begin
    insert into public.client_test_entries (test_id, value, measured_on)
    values (t1, 10, current_date + 2);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('ENT registre amb data futura', '23514', v);

  begin
    insert into public.client_tests (client_id, title) values (c, 'DOMINADES');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('ENT títol repetit (majúscules)', '23505', v);

  update public.client_test_entries set value = 11, test_id = t2 where id = e1;
  select value::text || '|' || (test_id = t1)::text into v from public.client_test_entries where id = e1;
  insert into r (cas, esperat, obtingut) values ('ENT edita valor; test_id no es mou', '11.000|true', v);

  begin
    perform public.reorder_client_tests(c, array[t2, t1]);
    select string_agg(title, ',' order by position) into v from public.client_tests where client_id = c;
  exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('ENT reordena', 'Perímetre abdominal,Dominades', v);

  select count(*) into n from public.client_test_suggestions() s where s.title = 'Dominades' and s.unit = 'reps';
  insert into r (cas, esperat, obtingut) values ('ENT veu el suggeriment', '1', n::text);

  perform pg_temp.prou();
end $$;

-- ─── Client Demo: llegeix els seus, no escriu ──────────────────────────────
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t1 uuid := current_setting('t.t1')::uuid;
  e1 uuid := current_setting('t.e1')::uuid;
  v text; n int;
begin
  perform pg_temp.com('d3b42dcb-7c11-4431-abc0-723b21add106');
  insert into r (cas, esperat, obtingut) values ('auth.uid() = Client Demo', 'd3b42dcb…', left(auth.uid()::text, 8) || '…');

  select count(*) into n from public.client_tests where client_id = c;
  insert into r (cas, esperat, obtingut) values ('CLI llegeix els seus tests', '2', n::text);
  select count(*) into n from public.client_test_entries where client_id = c;
  insert into r (cas, esperat, obtingut) values ('CLI llegeix els seus registres', '2', n::text);

  begin
    insert into public.client_tests (client_id, title) values (c, 'Planxa');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('CLI crea test', '42501', v);

  begin
    insert into public.client_test_entries (test_id, value) values (t1, 99);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('CLI crea registre', '42501', v);

  update public.client_test_entries set value = 99 where id = e1;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('CLI edita registre (files)', '0', n::text);

  delete from public.client_tests where id = t1;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('CLI esborra test (files)', '0', n::text);

  begin
    perform public.reorder_client_tests(c, array[t1, current_setting('t.t2')::uuid]);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('CLI reordena', '42501', v);

  select count(*) into n from public.client_test_suggestions();
  insert into r (cas, esperat, obtingut) values ('CLI suggeriments', '0', n::text);

  perform pg_temp.prou();
end $$;

-- ─── Fisio Demo (NO assignat): res ─────────────────────────────────────────
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t1 uuid := current_setting('t.t1')::uuid;
  v text; n int;
begin
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  insert into r (cas, esperat, obtingut) values ('auth.uid() = Fisio Demo', '1c36928b…', left(auth.uid()::text, 8) || '…');

  select count(*) into n from public.client_tests where client_id = c;
  insert into r (cas, esperat, obtingut) values ('FIS no assignat llegeix tests', '0', n::text);
  select count(*) into n from public.client_test_entries where client_id = c;
  insert into r (cas, esperat, obtingut) values ('FIS no assignat llegeix registres', '0', n::text);

  begin
    insert into public.client_test_entries (test_id, value) values (t1, 1);
    v := 'ok';
  exception when others then v := sqlstate; end;
  -- No veu el test: el trigger no en troba el client (23502) abans de la RLS.
  insert into r (cas, esperat, obtingut) values ('FIS no assignat crea registre', '23502 o 42501', v);

  begin
    insert into public.client_tests (client_id, title) values (c, 'Goniometria');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('FIS no assignat crea test', '42501', v);

  -- Mateix món: els títols sí que els veu (no diuen de quin client són).
  select count(*) into n from public.client_test_suggestions() s where s.title = 'Dominades';
  insert into r (cas, esperat, obtingut) values ('FIS veu suggeriments del seu món', '1', n::text);

  perform pg_temp.prou();
end $$;

-- ─── anon: cap permís ──────────────────────────────────────────────────────
do $$
declare v text;
begin
  execute 'set local role anon';
  begin
    perform 1 from public.client_tests limit 1;
    v := 'ok';
  exception when others then v := sqlstate; end;
  execute 'reset role';
  insert into r (cas, esperat, obtingut) values ('anon llegeix client_tests', '42501', v);
end $$;

-- ─── same_world: l'Entrenador Demo passa a «real» (només aquí dins) ────────
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  t1 uuid := current_setting('t.t1')::uuid;
  e1 uuid := current_setting('t.e1')::uuid;
  v text; n int;
begin
  delete from public.demo_profiles where profile_id = '5119e112-74af-4c85-862b-829f6d726ea2';

  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  select count(*) into n from public.client_tests where client_id = c;
  insert into r (cas, esperat, obtingut) values ('MÓN: assignat però d''un altre món llegeix', '0', n::text);

  update public.client_test_entries set value = 1 where id = e1;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('MÓN: edita registre (files)', '0', n::text);

  begin
    insert into public.client_tests (client_id, title) values (c, 'Salt vertical');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('MÓN: crea test', '42501', v);

  select count(*) into n from public.client_test_suggestions() s where s.title = 'Dominades';
  insert into r (cas, esperat, obtingut) values ('MÓN: no veu títols demo', '0', n::text);

  perform pg_temp.prou();
end $$;

-- ─── Esborrar en cascada (com a postgres) ──────────────────────────────────
do $$
declare
  t1 uuid := current_setting('t.t1')::uuid;
  n int;
begin
  delete from public.client_tests where id = t1;
  select count(*) into n from public.client_test_entries where test_id = t1;
  insert into r (cas, esperat, obtingut) values ('Esborrar test s''emporta registres', '0', n::text);
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat
              or (esperat = '23502 o 42501' and obtingut in ('23502', '42501'))
            then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
