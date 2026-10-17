-- ============================================================================
-- VindiBCN · proves de la 0119 (arxiu clínic)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0119. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit (ni a l'arxiu,
-- ni al registre d'accessos).
--
-- Només comptes DEMO. Com a postgres (el que fa l'app amb la clau de servei):
--   1. Al Client Demo se li posa un historial complet (primera visita,
--      seguiment, una sessió de fisioteràpia passada amb la seva nota, un
--      document i dos consentiments, un de retirat) i s'arxiva: queda marcat
--      `is_demo`. Es mira què hi ha, fins quan i que s'ha anotat.
--   2. Un pacient REAL posat a mà, per comparar.
--   3. Qui llegeix què: demo amb demo, real amb real; l'admin, tot.
--   4. Ningú no hi escriu ni pot cridar les funcions amb sessió.
--   5. La purga: el vençut s'esborra, el no vençut no, i un pacient sense
--      entrades desapareix, anotat sense nom.
--   6. Un client que NO és demo s'arxiva amb `is_demo = false`.
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

-- 1. Arxivar el Client Demo (demo) -----------------------------------------------------
do $$
declare
  c uuid;
  res uuid;
  pid uuid := gen_random_uuid();
  j jsonb;
  ret record;
  v text;
  last_care date;
  n_follow int;
  n_notes int;
  total int;
begin
  select id into c from public.clients where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  if c is null then raise exception 'No trobo el client del Client Demo'; end if;
  perform set_config('t.client', c::text, true);

  delete from public.clinical_first_visits where client_id = c;
  insert into public.clinical_first_visits (client_id, body, created_by)
  values (c, 'Prova 0119: primera visita', '1c36928b-0668-4377-a5d8-c7befb2d78bc');
  insert into public.clinical_followups (client_id, author_id, body)
  values (c, '1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Prova 0119: seguiment');

  -- Una sessió de fisioteràpia passada (2 de març de 2026) amb la seva nota.
  begin
    insert into public.reservations (client_id, trainer_id, scheduled_at, service_type, status)
    values (c, '1c36928b-0668-4377-a5d8-c7befb2d78bc', '2026-03-02 10:00+01', 'fisioterapia', 'completed')
    returning id into res;
    insert into public.session_notes (reservation_id, author_id, body)
    values (res, '1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Prova 0119: nota de sessió');
    v := 'ok';
  exception when others then v := sqlstate || ' · ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('1 · Preparació: sessió de fisio i nota', 'ok', v);

  delete from public.consents where user_id = 'd3b42dcb-7c11-4431-abc0-723b21add106' and type = 'health_data';
  insert into public.consents (user_id, type, version, granted_at, revoked_at)
  values ('d3b42dcb-7c11-4431-abc0-723b21add106', 'health_data', '2026-06', '2026-06-15', '2026-09-01');
  insert into public.consents (user_id, type, version, granted_at)
  values ('d3b42dcb-7c11-4431-abc0-723b21add106', 'health_data', '2026-10', '2026-10-17');

  -- El que s'espera, a partir del que hi hagi (el Client Demo pot tenir altres
  -- sessions, seguiments o notes a producció).
  select (max(scheduled_at) at time zone 'Europe/Madrid')::date into last_care
    from public.reservations
   where client_id = c and service_type = 'fisioterapia' and status <> 'cancelled' and scheduled_at <= now();
  select count(*) into n_follow from public.clinical_followups where client_id = c;
  select count(*) into n_notes from public.session_notes sn join public.reservations rr on rr.id = sn.reservation_id
   where rr.client_id = c and rr.service_type = 'fisioterapia';
  total := 1 + n_follow + n_notes + 1 + 2;   -- primera visita + seguiments + notes + document + 2 consentiments
  perform set_config('t.total', total::text, true);

  select * into ret from public.clinical_retention_for(c);
  insert into r (cas, esperat, obtingut) values ('1 · Té historial i és demo', 'true · true', ret.has_history || ' · ' || ret.is_demo);
  insert into r (cas, esperat, obtingut) values ('1 · Fins quan: des de l''última sessió de fisio, +15 anys',
    last_care || ' → ' || (last_care + interval '15 years')::date,
    ret.last_care_on || ' → ' || ret.purge_after);

  j := public.archive_clinical_history(c, pid,
    jsonb_build_array(jsonb_build_object(
      'source_id', gen_random_uuid(), 'storage_path', pid || '/informe.pdf', 'file_name', 'informe.pdf',
      'file_size', 1234, 'mime_type', 'application/pdf', 'description', 'Ressonància', 'uploaded_at', '2026-04-01T10:00:00Z')),
    '5119e112-74af-4c85-862b-829f6d726ea2');
  insert into r (cas, esperat, obtingut) values ('1 · Arxivar: arxivat, demo i fins quan',
    'true · true · ' || (last_care + interval '15 years')::date,
    (j->>'archived') || ' · ' || (j->>'is_demo') || ' · ' || (j->>'purge_after'));
  insert into r (cas, esperat, obtingut) values ('1 · El pacient arxivat, marcat is_demo', 'true',
    (select is_demo::text from public.clinical_archive_patients where id = pid));
  perform set_config('t.demo_pid', pid::text, true);

  select string_agg(kind || '=' || n, ' ' order by kind) into v
    from (select kind, count(*) n from public.clinical_archive_entries where patient_id = pid group by kind) q;
  insert into r (cas, esperat, obtingut) values ('1 · Què s''ha arxivat', 'consent=2 document=1 first_visit=1 followup=' || n_follow || ' session_note=' || n_notes, v);

  select count(*)::text into v from public.clinical_archive_entries
   where patient_id = pid and kind = 'consent' and consent_revoked_at is not null;
  insert into r (cas, esperat, obtingut) values ('1 · El consentiment retirat, amb la data de retirada', '1', v);

  select count(*)::text into v from public.clinical_archive_entries
   where patient_id = pid and purge_after = (last_care + interval '15 years')::date;
  insert into r (cas, esperat, obtingut) values ('1 · Totes les entrades amb el mateix termini', total::text, v);

  select coalesce(min(author_name), '?') into v from public.clinical_archive_entries
   where patient_id = pid and kind = 'followup' and body = 'Prova 0119: seguiment';
  insert into r (cas, esperat, obtingut) values ('1 · L''autor, com a text', 'Fisio Demo', v);

  select count(*)::text into v from public.data_access_log
   where action = 'clinical_archive' and subject_profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  insert into r (cas, esperat, obtingut) values ('1 · Anotat al registre d''accessos', '1', v);

  begin
    j := public.archive_clinical_history(c, gen_random_uuid(), '[]'::jsonb, null);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('1 · Arxivar-lo dos cops (el mateix client)', '23505', v);
end $$;

-- 2. Un pacient REAL posat a mà ----------------------------------------------------------
do $$
declare pid uuid := gen_random_uuid();
begin
  insert into public.clinical_archive_patients (id, former_client_id, full_name, last_care_on, is_demo)
  values (pid, gen_random_uuid(), 'Pacient real de prova', '2026-01-01', false);
  insert into public.clinical_archive_entries (patient_id, kind, body, written_at, purge_after)
  values (pid, 'followup', 'real', now(), '2041-01-01');
  perform set_config('t.real_pid', pid::text, true);
end $$;

-- 3. Qui llegeix què ----------------------------------------------------------------------
create function pg_temp.llegeix(etiqueta text, qui uuid, demo_esperat text, real_esperat text) returns void language plpgsql as $$
declare n int;
begin
  perform pg_temp.com(qui);
  select count(*) into n from public.clinical_archive_entries where patient_id = current_setting('t.demo_pid')::uuid;
  insert into r (cas, esperat, obtingut) values ('3 · ' || etiqueta || ': entrades de l''arxiu demo', demo_esperat, n::text);
  select count(*) into n from public.clinical_archive_entries where patient_id = current_setting('t.real_pid')::uuid;
  insert into r (cas, esperat, obtingut) values ('3 · ' || etiqueta || ': entrades de l''arxiu real', real_esperat, n::text);
  perform pg_temp.prou();
end $$;

select pg_temp.llegeix('Fisio Demo (demo)',          '1c36928b-0668-4377-a5d8-c7befb2d78bc', current_setting('t.total'), '0');
select pg_temp.llegeix('Entrenador Demo (no fisio)', '5119e112-74af-4c85-862b-829f6d726ea2', '0', '0');
select pg_temp.llegeix('Client Demo (l''antic pacient)', 'd3b42dcb-7c11-4431-abc0-723b21add106', '0', '0');

update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
select pg_temp.llegeix('Admin',                      '5119e112-74af-4c85-862b-829f6d726ea2', current_setting('t.total'), '1');
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';

-- El Fisio Demo passa a «real» (només aquí dins): ara veu el real i no el demo.
delete from public.demo_profiles where profile_id = '1c36928b-0668-4377-a5d8-c7befb2d78bc';
select pg_temp.llegeix('Fisio «real»',               '1c36928b-0668-4377-a5d8-c7befb2d78bc', '0', '1');
insert into public.demo_profiles (profile_id, label) values ('1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Fisio Demo');

-- 4. Ningú no hi escriu ni crida les funcions amb sessió -----------------------------------
update public.profiles set role = 'admin' where id = '5119e112-74af-4c85-862b-829f6d726ea2';
do $$
declare v text;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  begin
    insert into public.clinical_archive_entries (patient_id, kind, written_at, purge_after)
    values (current_setting('t.demo_pid')::uuid, 'followup', now(), '2099-01-01');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('4 · Admin: afegir una entrada', '42501', v);
  begin
    update public.clinical_archive_entries set body = 'canviat' where patient_id = current_setting('t.demo_pid')::uuid;
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('4 · Admin: editar', '42501', v);
  begin
    delete from public.clinical_archive_patients where id = current_setting('t.demo_pid')::uuid;
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('4 · Admin: esborrar', '42501', v);
  begin
    perform public.purge_clinical_archive(array[]::uuid[], '2099-01-01');
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('4 · Admin: cridar la purga', '42501', v);
  begin
    perform public.archive_clinical_history(current_setting('t.client')::uuid, gen_random_uuid(), '[]'::jsonb, null);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('4 · Admin: cridar l''arxivat', '42501', v);
  begin
    perform public.clinical_retention_for(current_setting('t.client')::uuid);
    v := 'ok';
  exception when others then v := sqlstate; end;
  insert into r (cas, esperat, obtingut) values ('4 · Admin: cridar clinical_retention_for', '42501', v);
  perform pg_temp.prou();
end $$;
update public.profiles set role = 'trainer' where id = '5119e112-74af-4c85-862b-829f6d726ea2';

-- 5. La purga (de l'arxiu demo) -------------------------------------------------------------
do $$
declare
  pid uuid := current_setting('t.demo_pid')::uuid;
  total int := current_setting('t.total')::int;
  ids uuid[];
  n int;
begin
  -- Una entrada (el seguiment de prova) vençuda; la resta no.
  update public.clinical_archive_entries set purge_after = '2026-01-01'
   where patient_id = pid and kind = 'followup' and body = 'Prova 0119: seguiment';

  select array_agg(entry_id) into ids from public.clinical_archive_expired('2026-10-17') e where e.patient_id = pid;
  insert into r (cas, esperat, obtingut) values ('5 · Vençudes avui', '1', coalesce(array_length(ids, 1), 0)::text);

  -- Si l'app en passés de més (totes), només s'esborren les vençudes.
  select array_agg(id) into ids from public.clinical_archive_entries where patient_id = pid;
  n := public.purge_clinical_archive(ids, '2026-10-17');
  insert into r (cas, esperat, obtingut) values ('5 · Purga (li passo totes): esborra només la vençuda', '1', n::text);
  select count(*) into n from public.clinical_archive_entries where patient_id = pid;
  insert into r (cas, esperat, obtingut) values ('5 · …la resta es queda i el pacient hi és', (total - 1) || ' · 1',
    n || ' · ' || (select count(*) from public.clinical_archive_patients where id = pid));

  -- Totes vençudes: el pacient desapareix i s'anota sense nom.
  update public.clinical_archive_entries set purge_after = '2026-01-01' where patient_id = pid;
  select array_agg(entry_id) into ids from public.clinical_archive_expired('2026-10-17') e where e.patient_id = pid;
  n := public.purge_clinical_archive(ids, '2026-10-17');
  insert into r (cas, esperat, obtingut) values ('5 · Purga de la resta', (total - 1)::text, n::text);
  insert into r (cas, esperat, obtingut) values ('5 · El pacient ja no hi és', '0',
    (select count(*) from public.clinical_archive_patients where id = pid)::text);
  insert into r (cas, esperat, obtingut) values ('5 · Anotat, sense el nom', 'Arxiu clínic ' || pid,
    coalesce((select subject_label from public.data_access_log where action = 'clinical_purge' and subject_label like '%' || pid order by created_at desc limit 1), 'cap'));
  insert into r (cas, esperat, obtingut) values ('5 · L''arxiu real no s''ha tocat', '1',
    (select count(*) from public.clinical_archive_entries where patient_id = current_setting('t.real_pid')::uuid)::text);
end $$;

-- 6. Un client que no és demo s'arxiva com a real ---------------------------------------------
do $$
declare j jsonb;
begin
  -- L'arxiu demo d'abans ja s'ha purgat; el Client Demo passa a «real» aquí dins.
  delete from public.demo_profiles where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  j := public.archive_clinical_history(current_setting('t.client')::uuid, gen_random_uuid(), '[]'::jsonb, null);
  insert into r (cas, esperat, obtingut) values ('6 · Client no demo: arxivat i is_demo', 'true · false',
    (j->>'archived') || ' · ' || (j->>'is_demo'));
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
