-- VindiBCN · 0023 — Taula promotions (ofertes i descomptes)

create type public.discount_type as enum ('percentage', 'fixed_amount');
create type public.promotion_scope as enum ('service', 'package');

create table public.promotions (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  discount_type  public.discount_type  not null,
  discount_value numeric     not null check (discount_value > 0),
  scope          public.promotion_scope not null,
  service_type   text        null,  -- usa text per evitar dep circular amb l'enum
  service_id     uuid        null references public.services(id) on delete cascade,
  starts_at      date        not null,
  ends_at        date        not null check (ends_at >= starts_at),
  active         boolean     not null default true,
  created_at     timestamptz not null default now(),

  -- Exactament un dels dos camps ha d'estar informat
  constraint promotions_scope_check check (
    (scope = 'service'  and service_type is not null and service_id is null) or
    (scope = 'package'  and service_id   is not null and service_type is null)
  )
);

-- Índexs per a les consultes freqüents (filtrar per dates i actives)
create index promotions_active_dates on public.promotions (active, starts_at, ends_at);
create index promotions_service_id   on public.promotions (service_id) where service_id is not null;
create index promotions_service_type on public.promotions (service_type) where service_type is not null;

-- RLS
alter table public.promotions enable row level security;

-- Qualsevol usuari autenticat pot llegir (és informació de preus pública)
create policy "promotions_select"
  on public.promotions for select
  to authenticated
  using (true);

-- Només admin pot escriure
create policy "promotions_insert"
  on public.promotions for insert
  to authenticated
  with check (public.is_admin());

create policy "promotions_update"
  on public.promotions for update
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

create policy "promotions_delete"
  on public.promotions for delete
  to authenticated
  using (public.is_admin());
