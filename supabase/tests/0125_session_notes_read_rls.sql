-- ============================================================================
-- VindiBCN · proves de la 0125 (qui llegeix les notes de sessió)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0125. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit.
--
-- Comptes demo: el Client Demo (C), amb l'Entrenador Demo (E) d'assignat, i el
-- Fisio Demo (F). Tres sessions passades de C, totes fetes per F:
--   R1 fisioteràpia, amb nota · R2 grup, amb nota · R3 grup, sense nota.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;

create function pg_temp.com(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.prou() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  c uuid := '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';   -- Client Demo (fitxa)
  e uuid := '5119e112-74af-4c85-862b-829f6d726ea2';   -- Entrenador Demo
  f uuid := '1c36928b-0668-4377-a5d8-c7befb2d78bc';   -- Fisio Demo
  r1 uuid; r2 uuid; r3 uuid;
begin
  update public.clients set assigned_trainer_id = e where id = c;
  insert into public.reservations (client_id, trainer_id, scheduled_at, service_type, status)
  values (c, f, '2026-02-02 10:00+01', 'fisioterapia', 'completed') returning id into r1;
  insert into public.reservations (client_id, trainer_id, scheduled_at, service_type, status)
  values (c, f, '2026-02-03 10:00+01', 'grupo_reducido', 'completed') returning id into r2;
  insert into public.reservations (client_id, trainer_id, scheduled_at, service_type, status)
  values (c, f, '2026-02-04 10:00+01', 'grupo_reducido', 'completed') returning id into r3;
  insert into public.session_notes (reservation_id, author_id, body) values (r1, f, 'Prova 0125: nota de fisio');
  insert into public.session_notes (reservation_id, author_id, body) values (r2, f, 'Prova 0125: nota de grup');
  perform set_config('t.r1', r1::text, true);
  perform set_config('t.r2', r2::text, true);
  perform set_config('t.r3', r3::text, true);
end $$;

-- Quantes de les dues notes (fisio, grup) veu cadascú.
create function pg_temp.veu(etiqueta text, qui uuid, esperat text) returns void language plpgsql as $$
declare v text;
begin
  perform pg_temp.com(qui);
  select coalesce(sum(case when reservation_id = current_setting('t.r1')::uuid then 1 else 0 end), 0) || ' · ' ||
         coalesce(sum(case when reservation_id = current_setting('t.r2')::uuid then 1 else 0 end), 0)
    into v
    from public.session_notes
   where reservation_id in (current_setting('t.r1')::uuid, current_setting('t.r2')::uuid);
  perform pg_temp.prou();
  insert into r (cas, esperat, obtingut) values ('1 · ' || etiqueta || ' (fisio · grup)', esperat, v);
end $$;

select pg_temp.veu('Client Demo', 'd3b42dcb-7c11-4431-abc0-723b21add106', '1 · 1');
select pg_temp.veu('Fisio Demo (les va fer)', '1c36928b-0668-4377-a5d8-c7befb2d78bc', '1 · 1');
select pg_temp.veu('Entrenador Demo, ASSIGNAT', '5119e112-74af-4c85-862b-829f6d726ea2', '1 · 1');

-- L'Entrenador Demo deixa de ser l'assignat: ja no en veu cap.
update public.clients set assigned_trainer_id = null where id = '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';
select pg_temp.veu('Entrenador Demo, NO assignat', '5119e112-74af-4c85-862b-829f6d726ea2', '0 · 0');
update public.clients set assigned_trainer_id = '5119e112-74af-4c85-862b-829f6d726ea2' where id = '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';

-- L'Entrenador Demo fet admin (només aquí dins): les veu totes.
update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
update public.clients set assigned_trainer_id = null where id = '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';
select pg_temp.veu('Admin', '5119e112-74af-4c85-862b-829f6d726ea2', '1 · 1');
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
update public.clients set assigned_trainer_id = '5119e112-74af-4c85-862b-829f6d726ea2' where id = '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';

-- Demo amb demo: el Fisio Demo passa a «real» (només aquí dins) i ja no en veu cap.
delete from public.demo_profiles where profile_id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
select pg_temp.veu('Fisio Demo fet «real»', '1c36928b-0668-4377-a5d8-c7befb2d78bc', '0 · 0');
insert into public.demo_profiles (profile_id, label) values ('1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Fisio Demo');

-- Escriure no canvia: només qui va fer la sessió.
do $$
declare v text; n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');   -- Entrenador Demo, assignat
  begin
    insert into public.session_notes (reservation_id, author_id, body)
    values (current_setting('t.r3')::uuid, '5119e112-74af-4c85-862b-829f6d726ea2', 'No hauria de poder');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('2 · Entrenador assignat: escriure una nota d''una sessió que no ha fet', '42501', v);
  update public.session_notes set body = 'Canviat' where reservation_id = current_setting('t.r1')::uuid;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('2 · Entrenador assignat: editar la nota de fisio', '0 files', n || ' files');
  perform pg_temp.prou();

  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');   -- Fisio Demo, qui la va fer
  begin
    insert into public.session_notes (reservation_id, author_id, body)
    values (current_setting('t.r3')::uuid, '1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Prova 0125: la seva');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('2 · Qui va fer la sessió: escriure-hi la nota', 'ok', v);
  perform pg_temp.prou();
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
