-- ============================================================================
-- VindiBCN · 0115 — editar segueix funcionant i ningú no canvia l'autor
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0115. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit.
--
-- Només comptes DEMO. Com a postgres, al Client Demo:
--   · una «Primera visita» creada i editada per l'ENTRENADOR Demo (així es veu
--     quan l'edita un altre);
--   · un «Seguiment» escrit pel FISIO Demo;
--   · totes dues amb data d'edició 01/01/2026 (trigger aturat un moment: dins
--     d'una transacció `now()` no canvia).
-- Després, amb la sessió del Fisio Demo (pot editar qualsevol primera visita i
-- els seus seguiments, 0110), s'edita el text i s'intenta canviar l'autor.
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
  fis constant uuid := '1c36928b-0668-4377-a5d8-c7befb2d78bc';
  ent constant uuid := '5119e112-74af-4c85-862b-829f6d726ea2';
  c uuid;
  f uuid;
begin
  select id into c from public.clients where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106';
  if c is null then raise exception 'No trobo el client del Client Demo'; end if;

  delete from public.clinical_first_visits where client_id = c;
  insert into public.clinical_first_visits (client_id, body, created_by) values (c, 'Text original', ent);
  insert into public.clinical_followups (client_id, author_id, body) values (c, fis, 'Seguiment original')
  returning id into f;

  alter table public.clinical_first_visits disable trigger clinical_first_visits_touch;
  alter table public.clinical_followups disable trigger clinical_followups_touch;
  update public.clinical_first_visits set updated_at = '2026-01-01 10:00+00', updated_by = ent where client_id = c;
  update public.clinical_followups set updated_at = '2026-01-01 10:00+00' where id = f;
  alter table public.clinical_first_visits enable trigger clinical_first_visits_touch;
  alter table public.clinical_followups enable trigger clinical_followups_touch;

  perform set_config('t.client', c::text, true);
  perform set_config('t.f', f::text, true);
end $$;

-- Amb la sessió del Fisio Demo -------------------------------------------------
do $$
declare
  fis constant uuid := '1c36928b-0668-4377-a5d8-c7befb2d78bc';
  ent constant uuid := '5119e112-74af-4c85-862b-829f6d726ea2';
  c uuid := current_setting('t.client')::uuid;
  f uuid := current_setting('t.f')::uuid;
  n int;
  fv public.clinical_first_visits;
  fu public.clinical_followups;
begin
  perform pg_temp.com(fis);
  insert into r (cas, esperat, obtingut) values ('auth.uid() = Fisio Demo', '1c36928b…', left(auth.uid()::text, 8) || '…');

  -- 1. Seguiment: canviar l'autor a un altre (sense tocar el text)
  update public.clinical_followups set author_id = ent where id = f;
  select * into fu from public.clinical_followups where id = f;
  insert into r (cas, esperat, obtingut) values ('Seguiment: canviar l''autor a l''Entrenador → segueix sent', 'el fisio',
    case fu.author_id when fis then 'el fisio' when ent then 'l''entrenador' else coalesce(fu.author_id::text, 'NULL') end);

  -- 2. Seguiment: treure l'autor (NULL) amb el perfil viu
  update public.clinical_followups set author_id = null where id = f;
  select * into fu from public.clinical_followups where id = f;
  insert into r (cas, esperat, obtingut) values ('Seguiment: posar l''autor a NULL → segueix sent', 'el fisio',
    case fu.author_id when fis then 'el fisio' else coalesce(fu.author_id::text, 'NULL') end);
  insert into r (cas, esperat, obtingut) values ('Seguiment: sense canviar el text, la data d''edició', 'la mateixa',
    case when fu.updated_at = '2026-01-01 10:00+00' then 'la mateixa' else 'canviada' end);

  -- 3. Seguiment: editar el text
  update public.clinical_followups set body = 'Seguiment editat' where id = f;
  get diagnostics n = row_count;
  select * into fu from public.clinical_followups where id = f;
  insert into r (cas, esperat, obtingut) values ('Seguiment: editar el text (files)', '1', n::text);
  insert into r (cas, esperat, obtingut) values ('Seguiment: després d''editar, la data d''edició', 'canviada',
    case when fu.updated_at = '2026-01-01 10:00+00' then 'la mateixa' else 'canviada' end);
  insert into r (cas, esperat, obtingut) values ('Seguiment: després d''editar, l''autor', 'el fisio',
    case fu.author_id when fis then 'el fisio' else coalesce(fu.author_id::text, 'NULL') end);

  -- 4. Primera visita: canviar «creada per» i «editada per» sense tocar el text
  update public.clinical_first_visits set created_by = fis, updated_by = fis where client_id = c;
  select * into fv from public.clinical_first_visits where client_id = c;
  insert into r (cas, esperat, obtingut) values ('Primera visita: canviar «creada per» → segueix sent', 'l''entrenador',
    case fv.created_by when ent then 'l''entrenador' when fis then 'el fisio' else coalesce(fv.created_by::text, 'NULL') end);
  insert into r (cas, esperat, obtingut) values ('Primera visita: canviar «editada per» sense editar → segueix sent', 'l''entrenador',
    case fv.updated_by when ent then 'l''entrenador' when fis then 'el fisio' else coalesce(fv.updated_by::text, 'NULL') end);
  insert into r (cas, esperat, obtingut) values ('Primera visita: sense canviar el text, la data d''edició', 'la mateixa',
    case when fv.updated_at = '2026-01-01 10:00+00' then 'la mateixa' else 'canviada' end);

  -- 5. Primera visita: posar «creada per» a NULL amb el perfil viu
  update public.clinical_first_visits set created_by = null where client_id = c;
  select * into fv from public.clinical_first_visits where client_id = c;
  insert into r (cas, esperat, obtingut) values ('Primera visita: posar «creada per» a NULL → segueix sent', 'l''entrenador',
    case fv.created_by when ent then 'l''entrenador' else coalesce(fv.created_by::text, 'NULL') end);

  -- 6. Primera visita: editar el text (la fisio, sobre una que va crear l'entrenador)
  update public.clinical_first_visits set body = 'Text editat per la fisio' where client_id = c;
  get diagnostics n = row_count;
  select * into fv from public.clinical_first_visits where client_id = c;
  insert into r (cas, esperat, obtingut) values ('Primera visita: editar el text (files)', '1', n::text);
  insert into r (cas, esperat, obtingut) values ('Primera visita: després d''editar, la data d''edició', 'canviada',
    case when fv.updated_at = '2026-01-01 10:00+00' then 'la mateixa' else 'canviada' end);
  insert into r (cas, esperat, obtingut) values ('Primera visita: després d''editar, «editada per»', 'el fisio',
    case fv.updated_by when fis then 'el fisio' when ent then 'l''entrenador' else coalesce(fv.updated_by::text, 'NULL') end);
  insert into r (cas, esperat, obtingut) values ('Primera visita: després d''editar, «creada per»', 'l''entrenador',
    case fv.created_by when ent then 'l''entrenador' else coalesce(fv.created_by::text, 'NULL') end);

  perform pg_temp.prou();
end $$;

-- L'Entrenador Demo (no és fisio) segueix sense poder editar ----------------------
do $$
declare
  c uuid := current_setting('t.client')::uuid;
  n int;
begin
  perform pg_temp.com('5119e112-74af-4c85-862b-829f6d726ea2');
  update public.clinical_first_visits set body = 'Intent de l''entrenador' where client_id = c;
  get diagnostics n = row_count;
  insert into r (cas, esperat, obtingut) values ('Entrenador: editar la primera visita (files)', '0', n::text);
  perform pg_temp.prou();
end $$;

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
