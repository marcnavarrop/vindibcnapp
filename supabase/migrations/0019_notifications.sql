-- ============================================================================
-- VindiBCN · 0019 — Sistema de notificacions
--
-- El codi dispara "esdeveniments" i el sistema decideix per quins canals
-- enviar-los segons les preferències de cada persona. Avui: email (Resend).
-- WhatsApp queda preparat al model (columnes _whatsapp) però sense backend.
--
-- Preferències en COLUMNES explícites (no JSONB): claredat, validació de tipus,
-- defaults per columna i consultes senzilles. Els esdeveniments són pocs i
-- estables, així que el cost d'afegir una columna nova és baix.
-- ============================================================================

-- profiles.phone ja existeix (0001), no cal afegir-lo.

-- a) Preferències de notificació (1:1 amb profiles).
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  reservation_confirmed_email   boolean not null default true,
  reservation_confirmed_whatsapp boolean not null default false,
  reservation_cancelled_email   boolean not null default true,
  reservation_cancelled_whatsapp boolean not null default false,
  session_reminder_email        boolean not null default false,
  session_reminder_whatsapp     boolean not null default false,
  trial_request_email           boolean not null default false,
  trial_request_whatsapp        boolean not null default false,
  trial_status_email            boolean not null default true,
  trial_status_whatsapp         boolean not null default false,
  bono_low_email                boolean not null default false,
  bono_low_whatsapp             boolean not null default false,
  community_email               boolean not null default false,
  community_whatsapp            boolean not null default false,
  created_at timestamptz not null default now()
);

-- b) Registre d'enviaments (auditoria + idempotència dels recordatoris).
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  recipient text,
  event_type text not null,
  channel text not null,
  status text not null, -- 'sent' | 'failed' | 'skipped_preference'
  error text,
  related_id uuid,
  sent_at timestamptz not null default now()
);

-- Idempotència: buscar ràpidament si ja s'ha enviat un recordatori per a X.
create index if not exists notification_log_idem_idx
  on public.notification_log (event_type, related_id, channel, status);
create index if not exists notification_log_profile_idx
  on public.notification_log (profile_id);

-- c) Crear preferències automàticament amb cada profile nou.
create or replace function public.handle_new_profile_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_prefs on public.profiles;
create trigger on_profile_created_prefs
  after insert on public.profiles
  for each row execute function public.handle_new_profile_prefs();

-- Backfill dels profiles ja existents.
insert into public.notification_preferences (profile_id)
select p.id from public.profiles p
left join public.notification_preferences np on np.profile_id = p.id
where np.id is null;

-- RLS: cadascú veu/edita les seves preferències; admin ho veu tot. El log
-- l'escriu el service_role (salta RLS); l'admin el pot llegir.
alter table public.notification_preferences enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists notif_prefs_own on public.notification_preferences;
create policy notif_prefs_own on public.notification_preferences
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists notif_prefs_update_own on public.notification_preferences;
create policy notif_prefs_update_own on public.notification_preferences
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists notif_prefs_admin on public.notification_preferences;
create policy notif_prefs_admin on public.notification_preferences
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists notif_log_admin on public.notification_log;
create policy notif_log_admin on public.notification_log
  for select using (public.is_admin());
