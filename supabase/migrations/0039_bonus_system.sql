-- ============================================================================
-- VindiBCN · 0039 — Sistema de bonus per volum de sessions
--
-- EINA DE CÀLCUL INTERN, com la resta de Facturació: no emet cap document amb
-- validesa fiscal.
--
-- Model: cada sessió completada val unes "unitats" segons el seu servei
-- (bonus_service_weights). Les unitats del període se sumen i sobre el total
-- s'apliquen trams PROGRESSIUS (bonus_tiers): les primeres N unitats a un
-- preu, les següents a un altre, com els trams d'IRPF. NO és "tot al preu del
-- tram més alt".
--
-- Pesos i trams són globals del centre. L'únic que varia per professional és
-- la freqüència de cobrament (bonus_worker_settings).
-- ============================================================================

-- `create type` no és idempotent: cal el guard per poder reexecutar el fitxer.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'bonus_payout_frequency') then
    create type public.bonus_payout_frequency as enum ('annual', 'biannual');
  end if;
end $$;

-- ─── Pesos per servei ───────────────────────────────────────────────────────
-- Mateix patró d'històric que service_rates: editar tanca la vigència de la
-- fila anterior i n'insereix una de nova.

create table if not exists public.bonus_service_weights (
  id              uuid primary key default gen_random_uuid(),
  service_type    text          not null,
  weight          numeric(6,3)  not null check (weight >= 0),
  effective_from  date          not null default current_date,
  effective_until date          null,
  created_at      timestamptz   not null default now(),

  constraint bonus_service_weights_period check (
    effective_until is null or effective_until >= effective_from
  )
);

create index if not exists bonus_service_weights_lookup
  on public.bonus_service_weights (service_type, effective_from desc);

-- ─── Trams progressius ──────────────────────────────────────────────────────
-- max_units null = tram obert (l'últim). El solapament entre trams d'una
-- mateixa vigència no es pot expressar amb un CHECK de fila; es valida a
-- l'aplicació abans de desar (lib/data/bonus.ts · validateTiers).

create table if not exists public.bonus_tiers (
  id              uuid primary key default gen_random_uuid(),
  min_units       numeric(10,2) not null check (min_units >= 0),
  max_units       numeric(10,2) null,
  rate_per_unit   numeric(10,4) not null check (rate_per_unit >= 0),
  effective_from  date          not null default current_date,
  effective_until date          null,
  created_at      timestamptz   not null default now(),

  constraint bonus_tiers_bounds check (max_units is null or max_units > min_units),
  constraint bonus_tiers_period check (
    effective_until is null or effective_until >= effective_from
  )
);

create index if not exists bonus_tiers_lookup
  on public.bonus_tiers (effective_from desc, min_units);

-- ─── Configuració per treballador ───────────────────────────────────────────

create table if not exists public.bonus_worker_settings (
  trainer_id       uuid primary key references public.profiles(id) on delete cascade,
  payout_frequency public.bonus_payout_frequency not null default 'annual',
  enabled          boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- ─── Bonus ja tancats ───────────────────────────────────────────────────────
-- Mateix criteri que settlements: fotografia fixa. Un cop generat, no es
-- recalcula encara que després canviïn pesos o trams.

create table if not exists public.bonus_payouts (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid          not null references public.profiles(id) on delete cascade,
  period_start    date          not null,
  period_end      date          not null,
  total_units     numeric(10,2) not null,
  total_amount    numeric(10,2) not null,
  tier_breakdown  jsonb         not null default '[]'::jsonb,
  generated_at    timestamptz   not null default now(),
  generated_by    uuid          null references public.profiles(id) on delete set null,

  constraint bonus_payouts_period check (period_end >= period_start)
);

create index if not exists bonus_payouts_trainer_period
  on public.bonus_payouts (trainer_id, period_start desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Escriptura: només admin, sempre.
-- Lectura: pesos i trams els pot llegir qualsevol professional autenticat
-- (necessita calcular el seu propi progrés); la configuració i els payouts,
-- només l'admin i el professional afectat.

alter table public.bonus_service_weights enable row level security;
alter table public.bonus_tiers           enable row level security;
alter table public.bonus_worker_settings enable row level security;
alter table public.bonus_payouts         enable row level security;

-- Helper de rol propi (evita repetir la subconsulta a cada política).
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'trainer'
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['bonus_service_weights', 'bonus_tiers'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format(
      'create policy "%1$s_select" on public.%1$I for select to authenticated
         using (public.is_admin() or public.is_trainer())', t);
  end loop;

  foreach t in array array[
    'bonus_service_weights', 'bonus_tiers', 'bonus_worker_settings', 'bonus_payouts'
  ] loop
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$I for insert to authenticated
         with check (public.is_admin())', t);

    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format(
      'create policy "%1$s_update" on public.%1$I for update to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);

    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$I for delete to authenticated
         using (public.is_admin())', t);
  end loop;
end $$;

-- Configuració i payouts: l'admin ho veu tot; el professional, només el seu.
drop policy if exists "bonus_worker_settings_select" on public.bonus_worker_settings;
create policy "bonus_worker_settings_select"
  on public.bonus_worker_settings for select
  to authenticated
  using (public.is_admin() or trainer_id = auth.uid());

drop policy if exists "bonus_payouts_select" on public.bonus_payouts;
create policy "bonus_payouts_select"
  on public.bonus_payouts for select
  to authenticated
  using (public.is_admin() or trainer_id = auth.uid());

comment on table public.bonus_service_weights is
  'Unitats que val una sessió completada de cada servei. Global del centre, amb vigència temporal.';
comment on table public.bonus_tiers is
  'Trams PROGRESSIUS sobre les unitats acumulades del període: cada tram cobra només la part que hi cau, com l''IRPF.';
comment on table public.bonus_worker_settings is
  'Únic paràmetre de bonus que varia per professional: si el té actiu i cada quant es tanca.';
comment on table public.bonus_payouts is
  'Bonus ja tancats. Fotografia fixa: no es recalculen si canvien pesos o trams.';
