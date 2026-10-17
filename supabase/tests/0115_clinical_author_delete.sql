-- ============================================================================
-- VindiBCN · 0115 — esborrar el perfil d'un autor de l'historial clínic
--
-- Per enganxar SENCER al SQL Editor. Es pot passar ABANS i DESPRÉS d'aplicar la
-- 0115: cada fila diu què s'espera en tots dos casos, i la columna `ok` compara
-- amb el que toca (mira si la 0115 hi és). Tot va dins d'una transacció que
-- acaba amb `rollback`: el perfil no s'esborra de debò.
--
-- PER QUÈ NO CREA LES ENTRADES AQUÍ DINS
--
-- Postgres no torna a comprovar una clau forània que no canvia… llevat que la
-- fila s'hagi creat en la MATEIXA transacció: llavors la comprova igualment.
-- Per això la primera versió d'aquesta prova donava sempre un error de FK
-- (23503): les entrades eren noves. Les de debò són d'abans, i llavors depèn del
-- cas (vegeu sota). Aquesta fa servir les
-- entrades del Fisio Demo que JA hi ha a la base (si no n'hi ha cap, abans cal
-- passar `0115_clinical_author_setup.sql`, que en desa una, i després netejar-la).
--
-- QUÈ S'ESPERA ABANS DE LA 0115 (depèn de les dades)
--
--   · Seguiments: l'esborrat no falla i queden orfes (la clau «no canvia»).
--   · Una primera visita creada I editada pel fisio (dues FK cap al perfil):
--     Postgres fa un UPDATE per FK; després del primer la fila ja és «d'aquesta
--     transacció» i al segon sí que comprova `created_by`: falla amb 23503.
--   Amb la 0115, en tots dos casos: esborrat sense error, autors a NULL i la data
--   d'edició igual.
--
-- Només comptes DEMO. No toca les entrades abans d'esborrar el perfil (tocar-les
-- aquí dins també faria saltar la comprovació).
-- ============================================================================

begin;

create temp table r (n serial, cas text, abans_0115 text, amb_0115 text, obtingut text) on commit drop;

do $$
declare
  fis constant uuid := '1c36928b-0668-4377-a5d8-c7befb2d78bc';
  total int;
  orfes int;
  canviades int;
  -- Primera visita creada I editada pel fisio: dues FK cap al perfil, i abans de
  -- la 0115 l'esborrat falla (23503). Sense cap, abans de la 0115 queda orfe.
  doble boolean;
  v text;
begin
  -- Foto de les entrades on surt el Fisio Demo, ABANS d'esborrar-lo.
  -- (Taula buida i després `insert`: dins d'un DO, un `create table … as` no
  -- veu les variables.)
  create temp table foto (tipus text, id text, updated_at timestamptz, body text) on commit drop;
  insert into foto
    select 'seguiment', f.id::text, f.updated_at, f.body
      from public.clinical_followups f where f.author_id = fis
    union all
    select 'primera visita', x.client_id::text, x.updated_at, x.body
      from public.clinical_first_visits x where x.created_by = fis or x.updated_by = fis;
  select count(*) into total from foto;
  select exists (select 1 from public.clinical_first_visits x where x.created_by = fis and x.updated_by = fis) into doble;

  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('Entrades de l''historial on surt el Fisio Demo (d''abans)', 'mín. 1', 'mín. 1',
          case when total = 0 then '0: cal el pas de preparació' else 'mín. 1' end);

  -- Altres taules on el perfil és NOT NULL + on delete set null: si n'hi ha cap,
  -- l'esborrat fallarà per elles (23502), no per l'historial.
  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('Progrés d''exercicis registrat pel Fisio Demo', '0', '0',
          (select count(*) from public.exercise_progress where recorded_by = fis)::text);
  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('Documents pujats pel Fisio Demo', '0', '0',
          (select count(*) from public.client_documents where uploaded_by = fis)::text);

  -- Esborrar el perfil
  begin
    delete from public.profiles where id = fis;
    v := 'ok';
  exception when others then
    v := sqlstate;
    -- Només informa: les tres columnes iguals perquè no compti com a ❌.
    insert into r (cas, abans_0115, amb_0115, obtingut) values ('(missatge de l''error)', sqlerrm, sqlerrm, sqlerrm);
  end;
  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('Esborrar el perfil del Fisio Demo', case when doble then '23503' else 'ok' end, 'ok', v);
  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('El perfil ja no existeix', case when doble then 'false' else 'true' end, 'true',
          (not exists (select 1 from public.profiles where id = fis))::text);

  -- Les mateixes entrades, després
  select count(*) into orfes from (
    select 1 from public.clinical_followups f
      join foto on foto.tipus = 'seguiment' and foto.id = f.id::text
     where f.author_id is not null and not exists (select 1 from public.profiles p where p.id = f.author_id)
    union all
    select 1 from public.clinical_first_visits x
      join foto on foto.tipus = 'primera visita' and foto.id = x.client_id::text
     where (x.created_by is not null and not exists (select 1 from public.profiles p where p.id = x.created_by))
        or (x.updated_by is not null and not exists (select 1 from public.profiles p where p.id = x.updated_by))
  ) q;
  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('Entrades que apunten a un perfil esborrat (orfes)', case when doble then '0' else 'mín. 1' end, '0',
          case when orfes = 0 then '0' else 'mín. 1' end);

  select count(*) into canviades from (
    select 1 from public.clinical_followups f
      join foto on foto.tipus = 'seguiment' and foto.id = f.id::text
     where f.updated_at is distinct from foto.updated_at
    union all
    select 1 from public.clinical_first_visits x
      join foto on foto.tipus = 'primera visita' and foto.id = x.client_id::text
     where x.updated_at is distinct from foto.updated_at
  ) q;
  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('Entrades amb la data d''edició canviada', case when doble then 'cap' else 'totes' end, 'cap',
          case when canviades = 0 then 'cap' when canviades = total then 'totes' else canviades || ' de ' || total end);

  insert into r (cas, abans_0115, amb_0115, obtingut)
  values ('El text de totes les entrades, intacte', 'true', 'true',
          (not exists (
             select 1 from foto
              where (foto.tipus = 'seguiment'
                     and not exists (select 1 from public.clinical_followups f where f.id::text = foto.id and f.body = foto.body))
                 or (foto.tipus = 'primera visita'
                     and not exists (select 1 from public.clinical_first_visits x where x.client_id::text = foto.id and x.body = foto.body))))::text);
end $$;

select n, cas, abans_0115, amb_0115, obtingut,
       case when obtingut = (case when exists (select 1 from pg_proc where proname = 'clinical_keep_author')
                                  then amb_0115 else abans_0115 end)
            then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
