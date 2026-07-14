-- ============================================================================
-- VindiBCN · 0018 — Sessions de prova gratuïtes (captació)
--
-- Un visitant SENSE COMPTE pot sol·licitar una sessió de prova d'entrenament.
-- Queda 'pending' (pre-bloquejant el forat) fins que l'entrenador l'accepta o
-- la rebutja. Caducitat PERESOSA: una 'pending' amb expires_at < now() es
-- considera caducada a tots els efectes (no bloqueja, no es mostra); es marca
-- 'expired' de manera oportunista quan es consulta. No hi ha cap cron.
-- ============================================================================
do $$ begin
  create type public.trial_status as enum (
    'pending', 'confirmed', 'rejected', 'expired', 'completed', 'no_show', 'cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  trainer_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  service_type public.service_type not null,
  status public.trial_status not null default 'pending',
  expires_at timestamptz not null,
  converted_client_id uuid references public.clients(id) on delete set null,
  consent_privacy_at timestamptz not null,
  ip text,
  created_at timestamptz not null default now(),
  -- Les proves són sempre d'entrenament, mai fisioteràpia.
  constraint trial_service_not_fisio check (service_type <> 'fisioterapia')
);

create index if not exists trial_bookings_trainer_idx
  on public.trial_bookings (trainer_id);
create index if not exists trial_bookings_slot_idx
  on public.trial_bookings (trainer_id, scheduled_at);
create index if not exists trial_bookings_status_idx
  on public.trial_bookings (status);
create index if not exists trial_bookings_email_idx
  on public.trial_bookings (lower(email));
create index if not exists trial_bookings_phone_idx
  on public.trial_bookings (phone);

-- RLS: l'app pública i el client escriuen/consulten via service_role (que salta
-- RLS). Els entrenadors i admins llegeixen/gestionen amb sessió. Activem RLS i
-- deixem que admin ho vegi tot i l'entrenador només les seves.
alter table public.trial_bookings enable row level security;

drop policy if exists trial_admin_all on public.trial_bookings;
create policy trial_admin_all on public.trial_bookings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists trial_trainer_select on public.trial_bookings;
create policy trial_trainer_select on public.trial_bookings
  for select using (trainer_id = auth.uid());

drop policy if exists trial_trainer_update on public.trial_bookings;
create policy trial_trainer_update on public.trial_bookings
  for update using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- PENDENT (no en aquesta migració): política de retenció automàtica que
-- elimini proves antigues en estat 'rejected' / 'expired' / 'no_show'.
