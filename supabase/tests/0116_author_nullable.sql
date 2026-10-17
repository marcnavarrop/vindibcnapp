-- ============================================================================
-- VindiBCN · 0116 — esborrar el perfil de qui va registrar progrés
--
-- Per enganxar SENCER al SQL Editor. Es pot passar ABANS i DESPRÉS d'aplicar la
-- 0116: cada fila diu què s'espera en tots dos casos, i `ok` compara amb el que
-- toca (mira si `recorded_by` ja admet NULL). Tot va dins d'una transacció que
-- acaba amb `rollback`: el perfil no s'esborra de debò.
--
-- Fa servir el progrés que el Fisio Demo JA té apuntat (desat abans d'aquesta
-- transacció). Si no en té cap, abans cal passar `0116_author_nullable_setup.sql`
-- i, en acabar, netejar-ho per id. Només comptes demo.
-- ============================================================================

begin;

create temp table r (n serial, cas text, abans_0116 text, amb_0116 text, obtingut text) on commit drop;

do $$
declare
  fis constant uuid := '1c36928b-0668-4377-a5d8-c7befb2d78bc';
  total int;
  v text;
begin
  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('exercise_progress.recorded_by admet NULL', 'NO', 'YES',
          (select is_nullable from information_schema.columns
            where table_schema = 'public' and table_name = 'exercise_progress' and column_name = 'recorded_by'));
  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('client_documents.uploaded_by admet NULL', 'NO', 'YES',
          (select is_nullable from information_schema.columns
            where table_schema = 'public' and table_name = 'client_documents' and column_name = 'uploaded_by'));

  -- Foto del progrés del Fisio Demo, abans d'esborrar-lo.
  create temp table foto (id uuid) on commit drop;
  insert into foto select p.id from public.exercise_progress p where p.recorded_by = fis;
  select count(*) into total from foto;
  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('Progrés apuntat pel Fisio Demo (d''abans)', 'mín. 1', 'mín. 1',
          case when total = 0 then '0: cal el pas de preparació' else 'mín. 1' end);

  begin
    delete from public.profiles where id = fis;
    v := 'ok';
  exception when others then
    v := sqlstate;
    -- Només informa: les tres columnes iguals perquè no compti com a ❌.
    insert into r (cas, abans_0116, amb_0116, obtingut) values ('(missatge de l''error)', sqlerrm, sqlerrm, sqlerrm);
  end;
  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('Esborrar el perfil del Fisio Demo', '23502', 'ok', v);
  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('El perfil ja no existeix', 'false', 'true',
          (not exists (select 1 from public.profiles where id = fis))::text);

  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('El progrés es queda (cap registre perdut)', 'true', 'true',
          ((select count(*) from public.exercise_progress p join foto on foto.id = p.id) = total)::text);
  insert into r (cas, abans_0116, amb_0116, obtingut)
  values ('…i sense autor (recorded_by NULL)', 'no', 'tots',
          (select case when count(*) filter (where p.recorded_by is null) = count(*) and count(*) > 0 then 'tots'
                       when count(*) filter (where p.recorded_by is null) = 0 then 'no'
                       else 'alguns' end
             from public.exercise_progress p join foto on foto.id = p.id));
end $$;

select n, cas, abans_0116, amb_0116, obtingut,
       case when obtingut = (case when (select is_nullable from information_schema.columns
                                         where table_schema = 'public' and table_name = 'exercise_progress'
                                           and column_name = 'recorded_by') = 'YES'
                                  then amb_0116 else abans_0116 end)
            then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
