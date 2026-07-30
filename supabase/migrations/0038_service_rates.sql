-- ============================================================================
-- VindiBCN · 0038 — La tarifa és del centre, no del professional
--
-- Correcció de disseny sobre la 0037: no hi ha diferenciació de tarifa entre
-- professionals. Hi ha UNA tarifa per tipus de servei, i s'aplica igual a
-- qualsevol entrenador/a o fisioterapeuta. Per això la taula nova no té
-- trainer_id.
--
-- El que NO canvia: la liquidació continua sent per professional (només conta
-- les seves sessions completades) i les tarifes continuen tenint vigència
-- temporal, de manera que cada sessió es valora amb la tarifa que hi havia el
-- dia que es va fer.
--
-- professional_rates es manté per no destruir dades, però ja no la fa servir
-- ningú. Un cop validat el desplegament es pot eliminar amb:
--   drop table public.professional_rates;
-- ============================================================================

create table if not exists public.service_rates (
  id              uuid primary key default gen_random_uuid(),
  -- text i no l'enum, mateix criteri que promotions.service_type.
  service_type    text        not null,
  -- Import fix per sessió completada, sigui quin sigui el professional. Per a
  -- grupo_reducido és l'import de la franja sencera.
  rate_amount     numeric(10,2) not null check (rate_amount >= 0),
  effective_from  date        not null default current_date,
  -- null = vigent indefinidament.
  effective_until date        null,
  created_at      timestamptz not null default now(),

  constraint service_rates_period check (
    effective_until is null or effective_until >= effective_from
  )
);

-- Consulta dominant: "quina tarifa tenia aquest servei el dia X".
create index if not exists service_rates_lookup
  on public.service_rates (service_type, effective_from desc);

-- ─── RLS: només admin, també en lectura (són dades de retribució) ───────────

alter table public.service_rates enable row level security;

drop policy if exists "service_rates_select" on public.service_rates;
create policy "service_rates_select"
  on public.service_rates for select
  to authenticated
  using (public.is_admin());

drop policy if exists "service_rates_insert" on public.service_rates;
create policy "service_rates_insert"
  on public.service_rates for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "service_rates_update" on public.service_rates;
create policy "service_rates_update"
  on public.service_rates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "service_rates_delete" on public.service_rates;
create policy "service_rates_delete"
  on public.service_rates for delete
  to authenticated
  using (public.is_admin());

comment on table public.service_rates is
  'Tarifa del centre per sessió completada de cada servei, amb vigència temporal. Igual per a tots els professionals. Eina de càlcul intern, sense validesa fiscal.';
comment on column public.service_rates.rate_amount is
  'Import fix per sessió completada. Per a grupo_reducido, import de la franja sencera.';

comment on table public.professional_rates is
  'OBSOLETA (0038): substituïda per service_rates, que no diferencia per professional. Pendent d''eliminar.';
