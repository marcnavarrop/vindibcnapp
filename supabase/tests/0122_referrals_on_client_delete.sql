-- ============================================================================
-- VindiBCN · proves de la 0122 (referits i baixa RGPD)
--
-- Per enganxar SENCER al SQL Editor DESPRÉS d'aplicar la 0122. Tot va dins
-- d'una transacció que acaba amb `rollback`: no queda res escrit ni esborrat.
--
-- Fa servir el Client Demo com a «qui plega» (X) i un altre client qualsevol
-- (Y). Dins de la transacció: Y referit per X, tres recompenses entre ells, i
-- s'esborra la fitxa de X. Després, `rollback`.
-- ============================================================================

begin;

create temp table r (n serial, cas text, esperat text, obtingut text) on commit drop;

-- 1. Les claus, com han de quedar (a = no action, n = set null, c = cascade).
insert into r (cas, esperat, obtingut)
select '1 · ' || conname, esperat,
       coalesce((select confdeltype::text from pg_constraint c where c.conname = e.conname
                   and c.conrelid = e.taula::regclass), 'no hi és')
  from (values
    ('referral_rewards_referrer_client_id_fkey',    'public.referral_rewards', 'n'),
    ('referral_rewards_referee_client_id_fkey',     'public.referral_rewards', 'n'),
    ('referral_rewards_beneficiary_client_id_fkey', 'public.referral_rewards', 'c'),
    ('referral_rewards_used_in_bono_id_fkey',       'public.referral_rewards', 'n'),
    ('clients_referred_by_client_id_fkey',          'public.clients',          'n')
  ) e(conname, taula, esperat);

-- 2. Preparació i baixa de X.
do $$
declare
  x uuid := '84fa4786-3307-48ce-9bbf-e45c49f2fe7e';  -- Client Demo
  y uuid;
  bo uuid;
  r1 uuid; r2 uuid; r3 uuid;
  v text;
begin
  select id into y from public.clients where id <> x order by created_at limit 1;
  select id into bo from public.bonos where client_id = x order by purchased_at limit 1;
  perform set_config('t.y', y::text, true);

  update public.clients set referred_by_client_id = x where id = y;
  -- r1: la de X (n'és el beneficiari), gastada en un bo seu si en té.
  insert into public.referral_rewards (referrer_client_id, referee_client_id, beneficiary_client_id, discount_percent, status, used_in_bono_id)
  values (x, y, x, 10, case when bo is null then 'pending' else 'used' end::referral_reward_status, bo) returning id into r1;
  -- r2: la de Y, amb X de padrí.
  insert into public.referral_rewards (referrer_client_id, referee_client_id, beneficiary_client_id, discount_percent)
  values (x, y, y, 10) returning id into r2;
  -- r3: la de Y, amb X de referit.
  insert into public.referral_rewards (referrer_client_id, referee_client_id, beneficiary_client_id, discount_percent)
  values (y, x, y, 10) returning id into r3;
  perform set_config('t.r1', r1::text, true);
  perform set_config('t.r2', r2::text, true);
  perform set_config('t.r3', r3::text, true);

  begin
    delete from public.clients where id = x;
    v := 'ok';
  exception when others then v := sqlstate || ' · ' || sqlerrm; end;
  insert into r (cas, esperat, obtingut) values ('2 · Esborrar la fitxa de qui té referits', 'ok', v);
end $$;

-- 3. Què ha quedat.
insert into r (cas, esperat, obtingut) values
  ('3 · La recompensa de X (beneficiari) se''n va amb ell', '0',
   (select count(*) from public.referral_rewards where id = current_setting('t.r1')::uuid)::text),
  ('3 · La de Y amb X de padrí es queda, sense padrí', 'null · ' || current_setting('t.y'),
   (select coalesce(referrer_client_id::text, 'null') || ' · ' || coalesce(referee_client_id::text, 'null')
      from public.referral_rewards where id = current_setting('t.r2')::uuid)),
  ('3 · La de Y amb X de referit es queda, sense referit', current_setting('t.y') || ' · null',
   (select coalesce(referrer_client_id::text, 'null') || ' · ' || coalesce(referee_client_id::text, 'null')
      from public.referral_rewards where id = current_setting('t.r3')::uuid)),
  ('3 · Y continua essent client, sense padrí', 'null',
   (select coalesce(referred_by_client_id::text, 'null') from public.clients where id = current_setting('t.y')::uuid));

select n, cas, esperat, obtingut,
       case when obtingut = esperat then '✅' else '❌' end as ok
  from r
 order by n;

rollback;
