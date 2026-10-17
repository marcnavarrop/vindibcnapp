-- ============================================================================
-- VindiBCN · proves de la 0121 (demo_profiles, l'única llista de comptes demo)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0121. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit (ni a
-- demo_profiles, ni al registre d'accessos).
--
--   1. La clau de servei (`service_role`) llegeix però NO escriu.
--   2. Amb sessió, ni llegir la taula ni cridar demo_world().
--   3. demo_world() torna els tres demo i la fitxa del Client Demo.
--   4. Per SQL (`postgres`) sí que s'hi escriu, i cada alta, canvi i baixa
--      queda al registre d'accessos.
--   5. is_demo_profile i same_world segueixen igual.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;
grant all on r to authenticated, service_role;
grant usage on sequence r_n_seq to authenticated, service_role;

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

-- Un perfil que NO és demo, per provar l'alta (només dins d'aquesta transacció).
do $$
declare p uuid;
begin
  select id into p from public.profiles
   where id not in (select profile_id from public.demo_profiles)
     and email is not null
   order by created_at limit 1;
  perform set_config('t.real', p::text, true);
end $$;

-- 1. La clau de servei ------------------------------------------------------------
do $$
declare v text; n int;
begin
  execute 'set local role service_role';
  begin
    select count(*) into n from public.demo_profiles;
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('1 · Clau de servei: llegir', 'ok', v);
  begin
    insert into public.demo_profiles (profile_id, label) values (current_setting('t.real')::uuid, 'Prova');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('1 · Clau de servei: afegir', '42501', v);
  begin
    update public.demo_profiles set label = label || '!' where label = 'Client Demo';
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('1 · Clau de servei: canviar', '42501', v);
  begin
    delete from public.demo_profiles where label = 'Client Demo';
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('1 · Clau de servei: treure', '42501', v);
  begin
    perform * from public.demo_world();
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('1 · Clau de servei: demo_world()', 'ok', v);
  execute 'reset role';
end $$;

-- 2. Amb sessió (el Client Demo i l'Entrenador Demo fet admin) --------------------
update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
create function pg_temp.amb_sessio(etiqueta text, qui uuid) returns void language plpgsql as $$
declare v text; n int;
begin
  perform pg_temp.com(qui);
  begin
    select count(*) into n from public.demo_profiles;
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('2 · ' || etiqueta || ': llegir la taula', '42501', v);
  begin
    insert into public.demo_profiles (profile_id, label) values (current_setting('t.real')::uuid, 'Prova');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('2 · ' || etiqueta || ': afegir', '42501', v);
  begin
    perform * from public.demo_world();
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('2 · ' || etiqueta || ': demo_world()', '42501', v);
  perform pg_temp.prou();
end $$;
select pg_temp.amb_sessio('Client Demo', 'd3b42dcb-7c11-4431-abc0-723b21add106');
select pg_temp.amb_sessio('Admin', '5119e112-74af-4c85-862b-829f6d726ea2');
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';

-- 3. demo_world() ------------------------------------------------------------------
insert into r (cas, esperat, obtingut)
select '3 · demo_world(): els tres demo hi són', '3',
       count(*)::text
  from public.demo_world()
 where profile_id in ('5119e112-74af-4c85-862b-829f6d726ea2',
                      '1c36928b-0668-4377-a5d8-c7befb2d78bc',
                      'd3b42dcb-7c11-4431-abc0-723b21add106');
insert into r (cas, esperat, obtingut)
select '3 · demo_world(): la fitxa del Client Demo', '84fa4786-3307-48ce-9bbf-e45c49f2fe7e',
       coalesce((select client_id::text from public.demo_world()
                  where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106'), 'cap');
insert into r (cas, esperat, obtingut)
select '3 · demo_world(): els professionals, sense fitxa de client', '0',
       count(client_id)::text
  from public.demo_world()
 where profile_id in ('5119e112-74af-4c85-862b-829f6d726ea2', '1c36928b-0668-4377-a5d8-c7befb2d78bc');
insert into r (cas, esperat, obtingut)
select '3 · demo_world(): una fila per perfil (com la taula)',
       (select count(*) from public.demo_profiles)::text,
       count(*)::text
  from public.demo_world();

-- 4. Per SQL sí, i queda registrat --------------------------------------------------
do $$
declare
  p uuid := current_setting('t.real')::uuid;
  abans int;
  n int;
  l text;
begin
  select count(*) into abans from public.data_access_log
   where action in ('demo_profile_added', 'demo_profile_removed') and subject_profile_id = p;

  insert into public.demo_profiles (profile_id, label) values (p, 'Prova 0121');
  select count(*), max(details) into n, l from public.data_access_log
   where action = 'demo_profile_added' and subject_profile_id = p;
  insert into r (cas, esperat, obtingut) values ('4 · SQL: afegir queda registrat', '1', n::text);
  insert into r (cas, esperat, obtingut) values ('4 · …amb qui ho ha fet (postgres)', 'sí',
    case when l like '%insert, postgres%' then 'sí' else coalesce(l, 'cap') end);
  insert into r (cas, esperat, obtingut) values ('4 · …i l''etiqueta i el correu', 'sí',
    case when (select subject_label from public.data_access_log
                where action = 'demo_profile_added' and subject_profile_id = p limit 1) like 'Prova 0121%<%>'
         then 'sí' else 'no' end);
  insert into r (cas, esperat, obtingut) values ('4 · …i ara és demo', 'true',
    public.is_demo_profile(p)::text);

  update public.demo_profiles set label = 'Prova 0121 bis' where profile_id = p;
  select count(*) into n from public.data_access_log
   where action in ('demo_profile_added', 'demo_profile_removed') and subject_profile_id = p;
  insert into r (cas, esperat, obtingut) values ('4 · SQL: canviar l''etiqueta deixa sortida i entrada', '3', (n - abans)::text);

  delete from public.demo_profiles where profile_id = p;
  select count(*) into n from public.data_access_log
   where action = 'demo_profile_removed' and subject_profile_id = p;
  insert into r (cas, esperat, obtingut) values ('4 · SQL: treure queda registrat', '2', n::text);
  insert into r (cas, esperat, obtingut) values ('4 · …i ja no és demo', 'false',
    public.is_demo_profile(p)::text);
end $$;

-- 5. La resta, igual -----------------------------------------------------------------
insert into r (cas, esperat, obtingut) values ('5 · is_demo_profile: els tres demo', 'true · true · true',
  public.is_demo_profile('5119e112-74af-4c85-862b-829f6d726ea2') || ' · ' ||
  public.is_demo_profile('1c36928b-0668-4377-a5d8-c7befb2d78bc') || ' · ' ||
  public.is_demo_profile('d3b42dcb-7c11-4431-abc0-723b21add106'));
do $$
declare v text;
begin
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  v := public.same_world('84fa4786-3307-48ce-9bbf-e45c49f2fe7e')::text;
  perform pg_temp.prou();
  insert into r (cas, esperat, obtingut) values ('5 · same_world: Fisio Demo amb el Client Demo', 'true', v);
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
