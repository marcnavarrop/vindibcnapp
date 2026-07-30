-- ============================================================================
-- VindiBCN · 0037 — Tarifes per professional i liquidacions
--
-- EINA DE CÀLCUL INTERN. Aquestes taules NO generen documents amb validesa
-- fiscal: només calculen quant correspon pagar a cada professional segons les
-- sessions completades. El marc fiscal real (nòmina o factura d'autònom,
-- retencions d'IRPF, IVA) l'ha de confirmar la gestoria del centre.
--
-- Historicitat: les tarifes no es modifiquen mai in situ. Editar-ne una tanca
-- la vigència de la fila anterior (effective_until = ahir) i n'insereix una de
-- nova (effective_from = avui), igual que ja fem amb els preus i les
-- promocions. Així una liquidació d'un període passat es pot recalcular amb la
-- tarifa que hi havia vigent aleshores.
-- ============================================================================

create table if not exists public.professional_rates (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid        not null references public.profiles(id) on delete cascade,
  -- text i no l'enum service_type: mateix criteri que promotions.service_type,
  -- per no lligar la taula a l'evolució de l'enum.
  service_type    text        not null,
  -- Import fix per sessió completada. Per a grupo_reducido és l'import de la
  -- franja sencera, independentment de quants clients hi assisteixin.
  rate_amount     numeric(10,2) not null check (rate_amount >= 0),
  effective_from  date        not null default current_date,
  -- null = vigent indefinidament.
  effective_until date        null,
  created_at      timestamptz not null default now(),

  constraint professional_rates_period check (
    effective_until is null or effective_until >= effective_from
  )
);

-- Consulta dominant: "quina tarifa tenia aquest professional per aquest servei
-- el dia X".
create index if not exists professional_rates_lookup
  on public.professional_rates (trainer_id, service_type, effective_from desc);

create table if not exists public.settlements (
  id                uuid primary key default gen_random_uuid(),
  trainer_id        uuid        not null references public.profiles(id) on delete cascade,
  period_start      date        not null,
  period_end        date        not null,
  total_amount      numeric(10,2) not null,
  -- Fotografia del desglossament en el moment de generar-la: quantes sessions
  -- de cada tipus, a quina tarifa i quin import. Es desa perquè la liquidació
  -- sigui consultable sense recalcular i, sobretot, perquè NO canviï mai si
  -- després es toquen les tarifes.
  session_breakdown jsonb       not null default '[]'::jsonb,
  generated_at      timestamptz not null default now(),
  generated_by      uuid        null references public.profiles(id) on delete set null,

  constraint settlements_period check (period_end >= period_start)
);

create index if not exists settlements_trainer_period
  on public.settlements (trainer_id, period_start desc);

-- ─── RLS: només admin, tant de lectura com d'escriptura ─────────────────────
-- Són dades de retribució: ni els propis professionals hi accedeixen des de
-- l'app. Qualsevol obertura futura ha de ser una decisió explícita.

alter table public.professional_rates enable row level security;
alter table public.settlements        enable row level security;

drop policy if exists "professional_rates_select" on public.professional_rates;
create policy "professional_rates_select"
  on public.professional_rates for select
  to authenticated
  using (public.is_admin());

drop policy if exists "professional_rates_insert" on public.professional_rates;
create policy "professional_rates_insert"
  on public.professional_rates for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "professional_rates_update" on public.professional_rates;
create policy "professional_rates_update"
  on public.professional_rates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "professional_rates_delete" on public.professional_rates;
create policy "professional_rates_delete"
  on public.professional_rates for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "settlements_select" on public.settlements;
create policy "settlements_select"
  on public.settlements for select
  to authenticated
  using (public.is_admin());

drop policy if exists "settlements_insert" on public.settlements;
create policy "settlements_insert"
  on public.settlements for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "settlements_update" on public.settlements;
create policy "settlements_update"
  on public.settlements for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "settlements_delete" on public.settlements;
create policy "settlements_delete"
  on public.settlements for delete
  to authenticated
  using (public.is_admin());

comment on table public.professional_rates is
  'Tarifa per sessió completada de cada professional i servei, amb vigència temporal. Eina de càlcul intern, sense validesa fiscal.';
comment on table public.settlements is
  'Liquidacions generades: fotografia fixa del càlcul d''un període. No es recalculen si canvien les tarifes.';
comment on column public.professional_rates.rate_amount is
  'Import fix per sessió completada. Per a grupo_reducido, import de la franja sencera.';
