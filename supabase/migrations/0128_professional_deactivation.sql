-- ============================================================================
-- VindiBCN · 0128 — Donar de baixa un professional: DESACTIVAR (reversible)
--
-- Decisió d'en Marc (17/10/2026): la baixa normal d'un professional és
-- desactivar-lo. No pot entrar, desapareix de l'agenda, dels selectors i de
-- /prova, i es conserva tot el seu historial amb el seu nom. Es pot reactivar.
--
--   · `profiles.deactivated_at` (NULL = actiu) i `deactivated_by`.
--   · L'app el bloqueja també a Auth (ban) i en tanca la sessió. A la base, per
--     si de cas: un perfil desactivat deixa de comptar com a admin, professional
--     o fisio (`current_role()`, `is_trainer()`, `is_physio()`), així que,
--     encara que tingués un token vàlid, la RLS no li dona res de l'equip.
--   · Només l'admin (o el servidor amb la clau de servei) pot desactivar o
--     reactivar, i mai a si mateix: un trigger com el del rol (0063).
--
-- Idempotent: `if not exists`, `create or replace`, `drop trigger if exists`.
-- ============================================================================

alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists deactivated_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.deactivated_at is
  'Donat de baixa (desactivat) per l''admin: no pot entrar i no compta com a equip. NULL = actiu. Reversible (0128).';

-- ─── 1. Qui ho pot canviar ───────────────────────────────────────────────────

create or replace function public.guard_profile_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deactivated_at is not distinct from old.deactivated_at then
    return new;
  end if;
  -- Sense sessió: el servidor amb la clau de servei (com a la 0063).
  if auth.uid() is null then
    return new;
  end if;
  if auth.uid() = new.id then
    raise exception 'No et pots donar de baixa (ni reactivar) a tu mateix.' using errcode = '42501';
  end if;
  if coalesce(public.is_admin(), false) then
    return new;
  end if;
  raise exception 'Només un administrador pot donar de baixa o reactivar un perfil.' using errcode = '42501';
end;
$$;

drop trigger if exists profiles_guard_deactivation on public.profiles;
create trigger profiles_guard_deactivation
  before update on public.profiles
  for each row execute function public.guard_profile_deactivation();

-- ─── 2. Un perfil desactivat no compta com a equip ───────────────────────────

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and deactivated_at is null
$$;

create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'trainer' and deactivated_at is null
  );
$$;

create or replace function public.is_physio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'trainer'
      and p.specialty = 'fisioterapeuta'
      and p.deactivated_at is null
  )
$$;

-- Els permisos d'aquestes funcions no canvien (0065, 0110): `create or replace`
-- els conserva.

-- ─── 3. Registre ─────────────────────────────────────────────────────────────

alter table public.data_access_log
  drop constraint if exists data_access_log_action_check;
alter table public.data_access_log
  add constraint data_access_log_action_check
  check (action in ('export', 'delete', 'clinical_view',
                    'clinical_archive', 'clinical_archive_view', 'clinical_archive_export', 'clinical_purge',
                    'demo_profile_added', 'demo_profile_removed',
                    'professional_deactivated', 'professional_reactivated'));
