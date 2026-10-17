-- ============================================================================
-- VindiBCN · proves de la 0127 i la 0128 (baixa d'un professional)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar les dues. Tot va dins
-- d'una transacció que acaba amb `rollback`: el professional de prova (creat a
-- auth.users com fa l'alta) i tot el que hi penja desapareixen.
--
-- 0127: s'esborra de cop el professional de prova (com des de Supabase) i es
--       mira que liquidacions, bonus, esperes, «dia fet», tiquets i registre
--       es queden, amb el nom.
-- 0128: desactivar i reactivar el Fisio Demo (només aquí dins): qui pot, i que
--       desactivat no compta com a equip.
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

-- ─── 0127 ────────────────────────────────────────────────────────────────────
insert into r (cas, esperat, obtingut)
select '1 · ' || t || '.' || c || ': on delete set null', 'n',
       coalesce((select confdeltype::text from pg_constraint where conname = k), 'no hi és')
  from (values
    ('settlements', 'trainer_id', 'settlements_trainer_id_fkey'),
    ('bonus_payouts', 'trainer_id', 'bonus_payouts_trainer_id_fkey'),
    ('waitlist_entries', 'trainer_id', 'waitlist_entries_trainer_id_fkey'),
    ('client_workout_logs', 'created_by', 'client_workout_logs_created_by_fkey'),
    ('support_tickets', 'created_by', 'support_tickets_created_by_fkey')
  ) x(t, c, k);

do $$
declare
  t uuid := gen_random_uuid();
  c uuid := '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';   -- Client Demo (fitxa)
  s uuid; b uuid; w uuid; d uuid; l uuid; k uuid; a uuid;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (t, 'prova0127-' || t || '@example.com', 'authenticated', 'authenticated',
          jsonb_build_object('full_name', 'Prova 0127 Professional'));
  update public.profiles set role = 'trainer' where id = t;

  insert into public.settlements (trainer_id, period_start, period_end, total_amount)
  values (t, '2026-01-01', '2026-01-31', 123.45) returning id into s;
  insert into public.bonus_payouts (trainer_id, period_start, period_end, total_units, total_amount, frequency)
  values (t, '2026-01-01', '2026-01-31', 10, 50, 'annual') returning id into b;
  insert into public.waitlist_entries (client_id, service_type, trainer_id, desired_date, desired_time)
  values (c, 'grupo_reducido', t, current_date + 7, '10:00') returning id into w;
  insert into public.client_workout_days (client_id, position)
  values (c, 9999) returning id into d;
  insert into public.client_workout_logs (client_id, day_id, day_number, created_by)
  values (c, d, 1, t) returning id into l;
  insert into public.support_tickets (created_by, title, description, category)
  values (t, 'Prova 0127', 'Tiquet de prova', 'bug') returning id into k;
  insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action, details)
  values (t, null, 'Prova 0127', 'export', 'Prova') returning id into a;

  perform set_config('t.s', s::text, true);
  perform set_config('t.b', b::text, true);
  perform set_config('t.w', w::text, true);
  perform set_config('t.l', l::text, true);
  perform set_config('t.k', k::text, true);
  perform set_config('t.a', a::text, true);
  perform set_config('t.t', t::text, true);
end $$;

insert into r (cas, esperat, obtingut) values
  ('2 · En crear la liquidació, el nom copiat', 'Prova 0127 Professional',
   (select coalesce(trainer_name, 'cap') from public.settlements where id = current_setting('t.s')::uuid)),
  ('2 · En crear el bonus, el nom copiat', 'Prova 0127 Professional',
   (select coalesce(trainer_name, 'cap') from public.bonus_payouts where id = current_setting('t.b')::uuid)),
  ('2 · En crear el tiquet, el nom copiat', 'Prova 0127 Professional',
   (select coalesce(created_by_name, 'cap') from public.support_tickets where id = current_setting('t.k')::uuid)),
  ('2 · Al registre, el nom de qui ho fa', 'sí',
   (select case when actor_label like 'Prova 0127 Professional <prova0127-%' then 'sí' else coalesce(actor_label, 'cap') end
      from public.data_access_log where id = current_setting('t.a')::uuid));

-- Esborrar-lo de cop, com des de Supabase.
do $$
declare v text;
begin
  begin
    delete from auth.users where id = current_setting('t.t')::uuid;
    v := 'ok';
  exception when others then v := sqlstate || ' · ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('3 · Esborrar el professional a Auth', 'ok', v);
end $$;

insert into r (cas, esperat, obtingut) values
  ('3 · La liquidació es queda, sense id i amb el nom', 'null · Prova 0127 Professional',
   coalesce((select coalesce(trainer_id::text, 'null') || ' · ' || coalesce(trainer_name, 'cap') from public.settlements where id = current_setting('t.s')::uuid), 'esborrada')),
  ('3 · El bonus es queda, amb el nom', 'null · Prova 0127 Professional',
   coalesce((select coalesce(trainer_id::text, 'null') || ' · ' || coalesce(trainer_name, 'cap') from public.bonus_payouts where id = current_setting('t.b')::uuid), 'esborrat')),
  ('3 · L''espera es queda, anul·lada i pendent d''avisar', 'cancelled · professional_baixa · null',
   coalesce((select status || ' · ' || coalesce(cancel_reason, 'cap') || ' · ' || coalesce(cancel_notified_at::text, 'null') from public.waitlist_entries where id = current_setting('t.w')::uuid), 'esborrada')),
  ('3 · El «dia fet» es queda, sense autor', 'null',
   coalesce((select coalesce(created_by::text, 'null') from public.client_workout_logs where id = current_setting('t.l')::uuid), 'esborrat')),
  ('3 · El tiquet es queda, amb el nom', 'null · Prova 0127 Professional',
   coalesce((select coalesce(created_by::text, 'null') || ' · ' || coalesce(created_by_name, 'cap') from public.support_tickets where id = current_setting('t.k')::uuid), 'esborrat')),
  ('3 · El registre conserva el nom de qui ho va fer', 'null · sí',
   coalesce((select coalesce(actor_id::text, 'null') || ' · ' || case when actor_label like 'Prova 0127 Professional%' then 'sí' else 'no' end from public.data_access_log where id = current_setting('t.a')::uuid), 'esborrat'));

-- ─── 0128 ────────────────────────────────────────────────────────────────────
-- E = Entrenador Demo, F = Fisio Demo.
do $$
declare v text;
begin
  -- Un professional no pot desactivar ningú.
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  begin
    update public.profiles set deactivated_at = now() where id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
    v := 'ok';
  exception when others then v := sqlstate; end;
  perform pg_temp.prou();
  -- La RLS ja li amaga la fila (0 files) o el trigger diu 42501: el que compta
  -- és que no ha canviat.
  insert into r (cas, esperat, obtingut) values ('4 · Un professional desactiva un altre', 'no ha canviat',
    (select case when deactivated_at is null then 'no ha canviat' else 'desactivat! (' || v || ')' end
       from public.profiles where id = '1c36928b-0668-4377-a5d8-c7befb2d78bc'));

  -- Ni a si mateix.
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  begin
    update public.profiles set deactivated_at = now() where id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
    v := 'ok';
  exception when others then v := sqlstate; end;
  perform pg_temp.prou();
  insert into r (cas, esperat, obtingut) values ('4 · Desactivar-se a si mateix', 'no ha canviat',
    (select case when deactivated_at is null then 'no ha canviat' else 'desactivat! (' || v || ')' end
       from public.profiles where id = '1c36928b-0668-4377-a5d8-c7befb2d78bc'));
end $$;

-- L'admin (l'Entrenador Demo fet admin, només aquí dins) sí.
update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
do $$
declare v text;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  begin
    update public.profiles set deactivated_at = now(), deactivated_by = '5119e112-74af-4c85-862b-829f6d726ea2'
     where id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
    v := 'ok';
  exception when others then v := sqlstate || ' · ' || sqlerrm; end;
  perform pg_temp.prou();
  insert into r (cas, esperat, obtingut) values ('4 · L''admin desactiva el Fisio Demo', 'ok', v);
end $$;

-- Desactivat, no compta com a equip.
do $$
declare v text;
begin
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  v := coalesce(public.current_role()::text, 'null') || ' · ' || public.is_trainer() || ' · ' || public.is_physio();
  perform pg_temp.prou();
  insert into r (cas, esperat, obtingut) values ('5 · Fisio desactivat: current_role · is_trainer · is_physio', 'null · false · false', v);
end $$;

-- Reactivar-lo (l'admin) i torna a comptar.
do $$
declare v text;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  update public.profiles set deactivated_at = null, deactivated_by = null where id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
  perform pg_temp.prou();
  perform pg_temp.com('1c36928b-0668-4377-a5d8-c7befb2d78bc');
  v := coalesce(public.current_role()::text, 'null') || ' · ' || public.is_trainer() || ' · ' || public.is_physio();
  perform pg_temp.prou();
  insert into r (cas, esperat, obtingut) values ('5 · Reactivat: torna a comptar', 'trainer · true · true', v);
end $$;
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';

-- El registre admet les accions noves.
do $$
declare v text;
begin
  begin
    insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action)
    values (null, '1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Fisio Demo', 'professional_deactivated');
    insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action)
    values (null, '1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Fisio Demo', 'professional_reactivated');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('6 · data_access_log: professional_deactivated i _reactivated', 'ok', v);
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
