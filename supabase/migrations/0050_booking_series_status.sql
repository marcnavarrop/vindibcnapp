-- ============================================================================
-- VindiBCN · 0050 — Estat explícit de les sèries de reserves
--
-- Fins ara una sèrie "viva" es deduïa: si li quedava alguna reserva futura,
-- sortia a "Les meves sèries"; si no, desapareixia. Funcionava per pintar la
-- llista, però no deixava constància de RES: una sèrie cancel·lada i una que
-- simplement s'havia acabat es veien igual a la base de dades (les dues,
-- sense reserves futures), i no hi havia manera de saber què havia passat.
--
-- Amb `status` la sèrie diu el seu final:
--   active     — encara en curs
--   cancelled  — el client la va cancel·lar sencera
--   completed  — totes les ocurrències ja han passat; es va fer del tot
--
-- La llista del client no canvia: segueix ensenyant només les 'active' amb
-- sessions pendents. Això és per tenir-ho escrit, no per ensenyar-ho.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_series_status') then
    create type public.booking_series_status as enum (
      'active',
      'cancelled',
      'completed'
    );
  end if;
end
$$;

alter table public.booking_series
  add column if not exists status public.booking_series_status not null default 'active';

comment on column public.booking_series.status is
  'active = en curs; cancelled = cancel·lada pel client; completed = totes les ocurrències ja han passat.';

-- Les sèries que ja existien es queden com a 'active' pel default. És correcte:
-- el tancament el posa el repàs peresós del llistat la primera vegada que el
-- client hi entri, i les que segueixin tenint sessions futures ho són de debò.

-- L'índex del llistat del client. Va per (client_id, status) perquè la consulta
-- sempre demana les d'un client i, ara, només les actives.
create index if not exists booking_series_client_status_idx
  on public.booking_series (client_id, status, created_at desc);
