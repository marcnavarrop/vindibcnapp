-- ============================================================================
-- VindiBCN · proves de la 0124 (novetats de la comunitat per als clients nous)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0124. Tot va dins
-- d'una transacció que acaba amb `rollback`: els dos usuaris de prova (a
-- auth.users, com fa el registre) desapareixen.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;

-- 1. El que ja hi era no ha canviat de regla.
insert into r (cas, esperat, obtingut) values
  ('1 · El valor per defecte de la columna segueix false', 'false',
   (select column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'notification_preferences' and column_name = 'community_email')),
  ('1 · Cap perfil d''abans queda pendent d''avisar', '0',
   (select count(*)::text from public.notification_preferences np
      join public.profiles p on p.id = np.profile_id
     where np.community_notice_at is null and p.created_at < now() - interval '1 minute'));

-- 2. Un client nou (com el registre: auth.users → profiles → preferències).
do $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (u, 'prova0124-client-' || u || '@example.com', 'authenticated', 'authenticated',
          jsonb_build_object('full_name', 'Prova 0124 client'));
  perform set_config('t.client', u::text, true);
end $$;

insert into r (cas, esperat, obtingut)
select '2 · Client nou: rol, correu de comunitat i encara per avisar', 'client · true · null',
       p.role || ' · ' || np.community_email || ' · ' || coalesce(np.community_notice_at::text, 'null')
  from public.profiles p join public.notification_preferences np on np.profile_id = p.id
 where p.id = current_setting('t.client')::uuid;

-- 3. Un professional nou: neix client i el servidor el puja tot seguit.
do $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (u, 'prova0124-pro-' || u || '@example.com', 'authenticated', 'authenticated',
          jsonb_build_object('full_name', 'Prova 0124 professional'));
  update public.profiles set role = 'trainer' where id = u;
  perform set_config('t.pro', u::text, true);
end $$;

insert into r (cas, esperat, obtingut)
select '3 · Professional nou: sense correu de comunitat', 'trainer · false · avisat',
       p.role || ' · ' || np.community_email || ' · ' || case when np.community_notice_at is null then 'null' else 'avisat' end
  from public.profiles p join public.notification_preferences np on np.profile_id = p.id
 where p.id = current_setting('t.pro')::uuid;

-- 4. Un client que ja havia triat (avisat) i passa a professional: es respecta.
update public.notification_preferences
   set community_email = true, community_notice_at = now() - interval '1 day'
 where profile_id = current_setting('t.client')::uuid;
update public.profiles set role = 'trainer' where id = current_setting('t.client')::uuid;
insert into r (cas, esperat, obtingut)
select '4 · Client avisat que passa a professional: es manté el que va triar', 'true',
       community_email::text
  from public.notification_preferences where profile_id = current_setting('t.client')::uuid;

-- 5. La funció del trigger no es pot cridar amb sessió.
insert into r (cas, esperat, obtingut) values
  ('5 · reset_community_email_on_promotion: sense execute per a authenticated', 'false',
   has_function_privilege('authenticated', 'public.reset_community_email_on_promotion()', 'execute')::text);

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
