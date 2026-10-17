-- ============================================================================
-- VindiBCN · proves de la 0118 (consentiment de salut 2026-10 i retirada)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0118. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit.
--
-- Només comptes DEMO. Dins de la transacció, com a postgres: el Client Demo té
-- l'Entrenador Demo assignat, un test de prova, i se li esborren els
-- consentiments de salut per començar de zero. Després, pas a pas: sense
-- consentiment, amb la versió 2026-06, amb la 2026-10, retirat i tornat a donar.
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

-- Amb la sessió de l'Entrenador Demo: què diu l'estat i si pot crear un test.
create function pg_temp.ent(etiqueta text, versio_esperada text, crear_esperat text) returns void language plpgsql as $$
declare
  c uuid := current_setting('t.client')::uuid;
  v text;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  select coalesce((select version from public.health_consent_status(c)), 'cap') into v;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': la fitxa veu la versió', versio_esperada, v);
  begin
    insert into public.client_tests (client_id, title) values (c, 'Prova 0118 ' || etiqueta);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values (etiqueta || ': l''entrenador crea un test', crear_esperat, v);
  perform pg_temp.prou();
end $$;

do $$
declare c uuid; t uuid;
begin
  select id into c from public.clients where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  if c is null then raise exception 'No trobo el client del Client Demo'; end if;
  update public.clients set assigned_trainer_id = '5119e112-74af-4c85-862b-829f6d726ea2' where id = c;
  insert into public.client_tests (client_id, title) values (c, 'Prova 0118') returning id into t;
  perform set_config('t.client', c::text, true);
  perform set_config('t.test', t::text, true);
  delete from public.consents where user_id = 'd3b42dcb-7c11-4431-abc0-723b21add106' and type = 'health_data';
end $$;

-- 1. Sense cap consentiment
select pg_temp.ent('1 · Sense consentiment', 'cap', '42501');

-- 2. Només la versió anterior (2026-06)
insert into public.consents (user_id, type, version, granted_at)
values ('d3b42dcb-7c11-4431-abc0-723b21add106', 'health_data', '2026-06', now() - interval '30 days');
select pg_temp.ent('2 · Versió 2026-06', '2026-06', '42501');

-- 3. El client accepta la 2026-10 (com ho fa l'app: una fila nova)
insert into public.consents (user_id, type, version)
values ('d3b42dcb-7c11-4431-abc0-723b21add106', 'health_data', '2026-10');
select pg_temp.ent('3 · Versió 2026-10', '2026-10', 'ok');

-- 4. Un altre (l'entrenador) no pot retirar el del client: només el seu
do $$
declare n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  n := public.revoke_health_consent();
  insert into r (cas, esperat, obtingut) values ('4 · L''entrenador crida revoke_health_consent: files del client tocades', '0', n::text);
  perform pg_temp.prou();
end $$;
select pg_temp.ent('4 · Després', '2026-10', 'ok');

-- 5. El client no pot tocar la taula de consentiments directament
do $$
declare n int; v text;
begin
  perform pg_temp.com('d3b42dcb-7c11-4431-abc0-723b21add106');
  -- «bloquejat»: cap fila tocada (sense política) o sense permís de taula.
  begin
    update public.consents set version = '2099-01' where user_id = auth.uid();
    get diagnostics n = row_count;
    v := case when n = 0 then 'bloquejat' else n || ' files' end;
  exception when insufficient_privilege then v := 'bloquejat'; end;
  insert into r (cas, esperat, obtingut) values ('5 · El client edita els seus consentiments', 'bloquejat', v);
  begin
    delete from public.consents where user_id = auth.uid();
    get diagnostics n = row_count;
    v := case when n = 0 then 'bloquejat' else n || ' files' end;
  exception when insufficient_privilege then v := 'bloquejat'; end;
  insert into r (cas, esperat, obtingut) values ('5 · El client esborra els seus consentiments', 'bloquejat', v);
  perform pg_temp.prou();
end $$;

-- 6. El client retira el consentiment des de l'app
do $$
declare n int;
begin
  perform pg_temp.com('d3b42dcb-7c11-4431-abc0-723b21add106');
  n := public.revoke_health_consent();
  insert into r (cas, esperat, obtingut) values ('6 · El client retira el seu (files marcades)', '2', n::text);
  select count(*) into n from public.consents
   where user_id = auth.uid() and type = 'health_data' and revoked_at is not null;
  insert into r (cas, esperat, obtingut) values ('6 · …les files es queden, marcades (les veu)', '2', n::text);
  perform pg_temp.prou();
end $$;
select pg_temp.ent('6 · Retirat', 'cap', '42501');

-- Amb el consentiment retirat, el test d'abans es pot editar
do $$
declare n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  update public.client_tests set description = 'editat sense consentiment' where id = current_setting('t.test')::uuid;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('6 · Retirat: l''entrenador edita el test d''abans (files)', '1', n::text);
  perform pg_temp.prou();
end $$;

-- 7. El client el torna a donar (l'app fa una fila nova)
do $$
declare v text;
begin
  perform pg_temp.com('d3b42dcb-7c11-4431-abc0-723b21add106');
  begin
    insert into public.consents (user_id, type, version) values (auth.uid(), 'health_data', '2026-10');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('7 · El client el torna a donar', 'ok', v);
  perform pg_temp.prou();
end $$;
select pg_temp.ent('7 · Tornat a donar', '2026-10', 'ok');

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
