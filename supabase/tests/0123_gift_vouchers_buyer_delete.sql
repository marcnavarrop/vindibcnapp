-- ============================================================================
-- VindiBCN · proves de la 0123 (vals de regal i baixa RGPD)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0123. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit ni esborrat.
--
-- X = el Client Demo (qui plega, només dins de la transacció); Y = un altre
-- client. Dos vals de prova: un que X va comprar (actiu, per bescanviar) i un
-- que Y va comprar i X va bescanviar.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;

insert into r (cas, esperat, obtingut) values
  ('1 · buyer_client_id: on delete set null', 'n',
   coalesce((select confdeltype::text from pg_constraint
              where conname = 'gift_vouchers_buyer_client_id_fkey' and conrelid = 'public.gift_vouchers'::regclass), 'no hi és')),
  ('1 · buyer_client_id admet NULL', 'sí',
   (select case when is_nullable = 'YES' then 'sí' else 'no' end from information_schema.columns
     where table_schema = 'public' and table_name = 'gift_vouchers' and column_name = 'buyer_client_id'));

do $$
declare
  x uuid := '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';  -- Client Demo
  y uuid;
  svc record;
  v1 uuid; v2 uuid;
  v text;
begin
  select id into y from public.clients where id <> x order by created_at limit 1;
  select id, service_type, greatest(default_sessions, 1) as total_sessions, name into svc from public.services order by created_at limit 1;

  insert into public.gift_vouchers (code, service_id, buyer_client_id, recipient_name, price, service_type,
                                    total_sessions, package_name, expires_at, status, pdf_path)
  values ('VINDI-T123-ACT1', svc.id, x, 'Amiga de prova', 50, svc.service_type, svc.total_sessions,
          coalesce(svc.name, 'Paquet'), current_date + 365, 'active', x || '/prova.pdf')
  returning id into v1;
  insert into public.gift_vouchers (code, service_id, buyer_client_id, price, service_type, total_sessions,
                                    package_name, expires_at, status, redeemed_at, redeemed_by_client_id)
  values ('VINDI-T123-RED1', svc.id, y, 50, svc.service_type, svc.total_sessions,
          coalesce(svc.name, 'Paquet'), current_date + 365, 'redeemed', now(), x)
  returning id into v2;
  perform set_config('t.v1', v1::text, true);
  perform set_config('t.v2', v2::text, true);
  perform set_config('t.x', x::text, true);

  begin
    delete from public.clients where id = x;
    v := 'ok';
  exception when others then v := sqlstate || ' · ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('2 · Esborrar qui en va comprar un i en va bescanviar un altre', 'ok', v);
end $$;

insert into r (cas, esperat, obtingut) values
  ('3 · El val que va comprar segueix viu, actiu i sense comprador', 'active · null',
   coalesce((select status || ' · ' || coalesce(buyer_client_id::text, 'null')
               from public.gift_vouchers where id = current_setting('t.v1')::uuid), 'esborrat')),
  ('3 · …amb el codi i el PDF de sempre', 'VINDI-T123-ACT1 · ' || current_setting('t.x') || '/prova.pdf',
   (select code || ' · ' || coalesce(pdf_path, 'null') from public.gift_vouchers where id = current_setting('t.v1')::uuid)),
  ('3 · El que va bescanviar segueix bescanviat, sense ell', 'redeemed · null',
   coalesce((select status || ' · ' || coalesce(redeemed_by_client_id::text, 'null')
               from public.gift_vouchers where id = current_setting('t.v2')::uuid), 'esborrat'));

-- 4. Un val bescanviat sense data encara es rebutja.
do $$
declare v text;
begin
  update public.gift_vouchers set redeemed_at = null where id = current_setting('t.v2')::uuid;
  v := 'ok';
exception when others then v := sqlstate;
  insert into r (cas, esperat, obtingut) values ('4 · Bescanviat sense data: rebutjat', '23514', v);
  return;
end $$;
insert into r (cas, esperat, obtingut)
select '4 · Bescanviat sense data: rebutjat', '23514', 'ok'
 where not exists (select 1 from r where cas like '4 ·%');

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
