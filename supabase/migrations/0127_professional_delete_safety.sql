-- ============================================================================
-- VindiBCN · 0127 — Si s'esborra un professional, no es perd res que calgui
--
-- Fins ara, esborrar l'usuari d'un professional a Auth (des de Supabase) feia
-- caure en cascada coses que s'han de conservar. Decisió d'en Marc
-- (17/10/2026): encara que la baixa normal sigui DESACTIVAR (0128), un esborrat
-- directe no ha de perdre:
--
--   · LIQUIDACIONS i FACTURES (`settlements`, i el seu PDF al bucket) i BONUS
--     PAGATS (`bonus_payouts`): obligació fiscal. Ara queden amb `trainer_id`
--     NULL i el nom copiat a `trainer_name` (el posa un trigger en crear-les, i
--     es reomple per a les d'abans).
--   · LLISTES D'ESPERA: abans s'esborraven sense dir res. Ara l'espera es queda,
--     passa a 'cancelled' amb `cancel_reason = 'professional_baixa'` i
--     `cancel_notified_at` NULL: el cron diari avisa el client i ho marca.
--     (`trainer_id` NULL vol dir «qualsevol professional»; per això no es pot
--     deixar en espera.)
--   · «DIA FET» de les pautes (`client_workout_logs.created_by`): és una dada
--     del client; es queda sense autor.
--   · TIQUETS DE SUPORT (`support_tickets.created_by`): es queden, amb el nom
--     copiat a `created_by_name`.
--   · REGISTRE D'ACCESSOS (`data_access_log`): `actor_label` guarda el nom de qui
--     ho va fer (el posa un trigger; es reomple per a les files d'abans).
--
-- Idempotent: `if not exists`, `drop constraint if exists`, `create or replace`.
-- ============================================================================

-- ─── 1. Liquidacions i bonus pagats ──────────────────────────────────────────

alter table public.settlements   add column if not exists trainer_name text;
alter table public.bonus_payouts add column if not exists trainer_name text;

update public.settlements s set trainer_name = p.full_name
  from public.profiles p where p.id = s.trainer_id and s.trainer_name is null;
update public.bonus_payouts b set trainer_name = p.full_name
  from public.profiles p where p.id = b.trainer_id and b.trainer_name is null;

alter table public.settlements   alter column trainer_id drop not null;
alter table public.bonus_payouts alter column trainer_id drop not null;

alter table public.settlements drop constraint if exists settlements_trainer_id_fkey;
alter table public.settlements add constraint settlements_trainer_id_fkey
  foreign key (trainer_id) references public.profiles (id) on delete set null;

alter table public.bonus_payouts drop constraint if exists bonus_payouts_trainer_id_fkey;
alter table public.bonus_payouts add constraint bonus_payouts_trainer_id_fkey
  foreign key (trainer_id) references public.profiles (id) on delete set null;

-- El nom, sempre: en crear-les (si no el porten) i si canvia el professional.
create or replace function public.fill_trainer_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trainer_id is not null and (new.trainer_name is null or tg_op = 'UPDATE' and new.trainer_id is distinct from old.trainer_id) then
    select full_name into new.trainer_name from public.profiles where id = new.trainer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_fill_trainer_name on public.settlements;
create trigger settlements_fill_trainer_name
  before insert or update of trainer_id on public.settlements
  for each row execute function public.fill_trainer_name();

drop trigger if exists bonus_payouts_fill_trainer_name on public.bonus_payouts;
create trigger bonus_payouts_fill_trainer_name
  before insert or update of trainer_id on public.bonus_payouts
  for each row execute function public.fill_trainer_name();

comment on column public.settlements.trainer_name is
  'Nom del professional en generar-la. Es conserva si se n''esborra el perfil (trainer_id NULL) (0127).';
comment on column public.bonus_payouts.trainer_name is
  'Nom del professional en generar-lo. Es conserva si se n''esborra el perfil (trainer_id NULL) (0127).';

-- ─── 2. Llistes d'espera ─────────────────────────────────────────────────────

alter table public.waitlist_entries add column if not exists cancel_reason text;
alter table public.waitlist_entries add column if not exists cancel_notified_at timestamptz;

alter table public.waitlist_entries drop constraint if exists waitlist_entries_trainer_id_fkey;
alter table public.waitlist_entries add constraint waitlist_entries_trainer_id_fkey
  foreign key (trainer_id) references public.profiles (id) on delete set null;

-- El `set null` de la clau forana fa un UPDATE intern, que sí que passa pels
-- triggers BEFORE (com a la 0115). Aquí, l'espera que es queda sense el seu
-- professional NO es converteix en «qualsevol professional»: s'anul·la, amb
-- el motiu, perquè el cron n'avisi el client.
create or replace function public.waitlist_trainer_gone()
returns trigger
language plpgsql
as $$
begin
  if old.trainer_id is not null and new.trainer_id is null then
    if old.status = 'waiting' then
      new.status := 'cancelled';
      new.cancel_reason := 'professional_baixa';
      new.cancel_notified_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists waitlist_trainer_gone on public.waitlist_entries;
create trigger waitlist_trainer_gone
  before update of trainer_id on public.waitlist_entries
  for each row execute function public.waitlist_trainer_gone();

comment on column public.waitlist_entries.cancel_reason is
  'Per què s''ha anul·lat sense que la persona ho demanés. ''professional_baixa'': el professional s''ha donat de baixa (0127).';
comment on column public.waitlist_entries.cancel_notified_at is
  'Quan se n''ha avisat el client (NULL = encara no) (0127).';

-- ─── 3. «Dia fet» de les pautes ──────────────────────────────────────────────

alter table public.client_workout_logs alter column created_by drop not null;
alter table public.client_workout_logs drop constraint if exists client_workout_logs_created_by_fkey;
alter table public.client_workout_logs add constraint client_workout_logs_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- ─── 4. Tiquets de suport ────────────────────────────────────────────────────

alter table public.support_tickets add column if not exists created_by_name text;
update public.support_tickets t set created_by_name = p.full_name
  from public.profiles p where p.id = t.created_by and t.created_by_name is null;
alter table public.support_tickets alter column created_by drop not null;
alter table public.support_tickets drop constraint if exists support_tickets_created_by_fkey;
alter table public.support_tickets add constraint support_tickets_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

create or replace function public.fill_ticket_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null and new.created_by_name is null then
    select full_name into new.created_by_name from public.profiles where id = new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists support_tickets_fill_author_name on public.support_tickets;
create trigger support_tickets_fill_author_name
  before insert on public.support_tickets
  for each row execute function public.fill_ticket_author_name();

-- ─── 5. Registre d'accessos: el nom de qui ho va fer ─────────────────────────

alter table public.data_access_log add column if not exists actor_label text;
update public.data_access_log l set actor_label = p.full_name || coalesce(' <' || p.email || '>', '')
  from public.profiles p where p.id = l.actor_id and l.actor_label is null;

create or replace function public.fill_actor_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_id is not null and new.actor_label is null then
    select full_name || coalesce(' <' || email || '>', '') into new.actor_label
      from public.profiles where id = new.actor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists data_access_log_fill_actor_label on public.data_access_log;
create trigger data_access_log_fill_actor_label
  before insert on public.data_access_log
  for each row execute function public.fill_actor_label();

comment on column public.data_access_log.actor_label is
  'Nom i correu de qui ho va fer, en el moment de fer-ho: es conserva si se n''esborra el perfil (0127).';

revoke execute on function public.fill_trainer_name()        from public, anon, authenticated;
revoke execute on function public.fill_ticket_author_name()  from public, anon, authenticated;
revoke execute on function public.fill_actor_label()         from public, anon, authenticated;
