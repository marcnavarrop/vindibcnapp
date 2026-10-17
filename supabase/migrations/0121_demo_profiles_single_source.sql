-- ============================================================================
-- VindiBCN · 0121 — `demo_profiles`, l'única llista de comptes demo
--
-- Fins ara l'app reconeixia els comptes demo amb ids fixos (lib/demo-accounts.ts)
-- i la base, amb `demo_profiles` (0110). Passa a ser una sola font: la taula.
-- Com que llavors marcar un compte com a demo canvia de debò qui el pot veure
-- (separació demo/real, arxiu clínic, números de l'Inici), escriure-hi es tanca
-- més i queda registrat:
--
--   · ESCRIURE-HI: només per SQL (SQL Editor o migració, rol `postgres`). Es
--     treu a `service_role` el permís d'inserir, modificar i esborrar: la clau
--     de servei de l'app només la pot LLEGIR. Amb sessió (`anon`,
--     `authenticated`) ja no s'hi podia fer res des de la 0110.
--   · REGISTRE: cada alta, baixa o canvi deixa una fila a `data_access_log`
--     (`demo_profile_added` / `demo_profile_removed`), amb el compte, l'etiqueta
--     i el rol de base de dades que ho ha fet. També quan cau en cascada perquè
--     s'ha esborrat el perfil.
--   · LECTURA: `demo_world()` torna en UNA consulta els perfils demo i les
--     seves fitxes de client; l'app la crida amb la clau de servei, una vegada
--     per petició.
--
-- El mode PRE NO passa a llegir aquesta taula: la seva llista blanca es queda
-- al codi (lib/pre-mode.ts) i, a més, l'app exigirà que el compte sigui a
-- `demo_profiles`. Marcar un compte real com a demo no hi dona accés.
--
-- Idempotent: `drop … if exists`, `create or replace`.
-- ============================================================================

-- ─── 1. Només lectura per a la clau de servei ────────────────────────────────

revoke insert, update, delete, truncate on public.demo_profiles from service_role;
grant select on public.demo_profiles to service_role;

-- ─── 2. Registre d'accessos ──────────────────────────────────────────────────

alter table public.data_access_log
  drop constraint if exists data_access_log_action_check;
alter table public.data_access_log
  add constraint data_access_log_action_check
  check (action in ('export', 'delete', 'clinical_view',
                    'clinical_archive', 'clinical_archive_view', 'clinical_archive_export', 'clinical_purge',
                    'demo_profile_added', 'demo_profile_removed'));

create or replace function public.log_demo_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.demo_profiles;
  who text;
begin
  -- Qui: amb sessió, el seu id; per SQL, el rol de base de dades (`postgres`).
  who := coalesce(auth.uid()::text, session_user::text);

  if tg_op in ('DELETE', 'UPDATE') then
    r := old;
    insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action, details)
    values (auth.uid(), r.profile_id,
            r.label || coalesce(' <' || (select email from public.profiles where id = r.profile_id) || '>', ''),
            'demo_profile_removed',
            'Fora de demo_profiles (' || lower(tg_op) || ', ' || who || ').');
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    r := new;
    insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action, details)
    values (auth.uid(), r.profile_id,
            r.label || coalesce(' <' || (select email from public.profiles where id = r.profile_id) || '>', ''),
            'demo_profile_added',
            'Afegit a demo_profiles (' || lower(tg_op) || ', ' || who || ').');
  end if;

  return null;
end;
$$;

comment on function public.log_demo_profile_change() is
  'Anota a data_access_log cada alta, baixa o canvi de demo_profiles (0121).';

drop trigger if exists demo_profiles_log on public.demo_profiles;
create trigger demo_profiles_log
  after insert or update or delete on public.demo_profiles
  for each row execute function public.log_demo_profile_change();

revoke execute on function public.log_demo_profile_change() from public, anon, authenticated;

-- ─── 3. El món demo, en una sola lectura ─────────────────────────────────────

create or replace function public.demo_world()
returns table (profile_id uuid, client_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select d.profile_id, c.id
    from public.demo_profiles d
    left join public.clients c on c.profile_id = d.profile_id
$$;

comment on function public.demo_world() is
  'Els perfils demo i, si en tenen, la seva fitxa de client. Una fila per perfil. Només clau de servei (0121).';

revoke execute on function public.demo_world() from public, anon, authenticated;
grant  execute on function public.demo_world() to service_role;
