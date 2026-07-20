-- VindiBCN · 0026 — Promocions: de camps únics a arrays
-- Permet que una oferta apliqui a múltiples service_types o service_ids alhora.
-- NOTA: service_ids usa uuid[] sense FK nativa (Postgres no suporta FK sobre arrays).
--       La integritat referencial es garanteix en codi (Server Action).

-- 1. Afegir les noves columnes d'array
alter table public.promotions
  add column service_types text[] null,
  add column service_ids   uuid[] null;

-- 2. Migrar dades existents (singular → array d'un sol element)
update public.promotions
  set service_types = array[service_type]
  where service_type is not null;

update public.promotions
  set service_ids = array[service_id]
  where service_id is not null;

-- 3. Eliminar columnes antigues amb CASCADE:
--    el CASCADE elimina automàticament el constraint que les referencia
--    (sigui quin sigui el seu nom) i els índexs dependents.
drop index if exists public.promotions_service_id;
drop index if exists public.promotions_service_type;

alter table public.promotions
  drop column service_type cascade,
  drop column service_id cascade;

-- 4. Afegir el nou constraint d'àmbit
alter table public.promotions add constraint promotions_scope_check check (
  (scope = 'service'
    and service_types is not null
    and array_length(service_types, 1) > 0
    and service_ids is null)
  or
  (scope = 'package'
    and service_ids is not null
    and array_length(service_ids, 1) > 0
    and service_types is null)
);

-- 5. Índexs GIN per a operacions de contenció (@>, &&)
create index promotions_service_types_gin
  on public.promotions using gin (service_types)
  where service_types is not null;

create index promotions_service_ids_gin
  on public.promotions using gin (service_ids)
  where service_ids is not null;
