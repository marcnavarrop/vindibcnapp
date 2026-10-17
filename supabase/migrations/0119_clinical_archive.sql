-- ============================================================================
-- VindiBCN · 0119 — L'arxiu clínic: l'historial es conserva quan el client plega
--
-- Decisió d'en Marc (17/10/2026), amb els criteris més conservadors mentre
-- l'assessor no diu res més concret. Llei 21/2000 (art. 12): una part de la
-- història clínica s'ha de conservar 15 anys des de l'alta; la resta, 5. Aquí,
-- 15 anys per a TOT; el termini va per entrada (`purge_after`), per poder passar
-- algun tipus a 5 anys sense tocar res més.
--
-- QUÈ PASSAVA FINS ARA
--
-- El borrat RGPD d'un client (admin → «Eliminar client») esborra l'usuari
-- d'Auth i tot cau en cascada: primera visita, seguiments, notes de sessió (amb
-- les reserves), documents (els esborra abans l'app) i consentiments.
--
-- QUÈ FA AQUESTA MIGRACIÓ
--
--   · `clinical_archive_patients`: el pacient arxivat, separat del compte (sense
--     clau forània al client, que desapareix): nom, data de naixement, correu,
--     telèfon, data de l'última atenció i qui l'ha arxivat.
--   · `clinical_archive_entries`: el que es conserva, una fila per element, amb
--     el seu `purge_after`: primera visita, seguiments, notes de sessió de
--     fisioteràpia, documents que va aportar el client (el fitxer es COPIA al
--     bucket privat `clinical-archive`) i tots els consentiments de salut
--     (versió, data i retirada). Els autors, com a text fix (el perfil pot
--     desaparèixer).
--   · Bucket `clinical-archive`, privat i SENSE cap política per a usuaris amb
--     sessió: només hi entra la clau de servei. L'app dona URL signades després
--     de comprovar, amb la RLS de les taules, que qui ho demana hi pot llegir.
--   · Llegeixen (RLS): l'admin i els fisios, demo amb demo. NINGÚ no hi escriu
--     per l'API: ni polítiques d'escriptura ni permisos; només les funcions.
--   · Funcions (només per a la clau de servei, que fan servir el borrat i el
--     cron després de comprovar el rol):
--       - `clinical_retention_for(client)`: té historial? és demo? fins quan es
--         conservaria? (per a la confirmació de la baixa)
--       - `archive_clinical_history(...)`: arxiva, tot o res, i ho anota.
--       - `clinical_archive_expired(dia)`: què ha vençut (amb els fitxers).
--       - `purge_clinical_archive(ids, dia)`: esborra el vençut i ho anota.
--   · `data_access_log` admet 'clinical_archive', 'clinical_archive_view',
--     'clinical_archive_export' i 'clinical_purge'.
--
-- QUÈ ÉS «TENIR HISTORIAL»: primera visita, algun seguiment o alguna nota de
-- sessió d'una reserva de fisioteràpia. Els documents i els consentiments
-- s'arxiven només si n'hi ha (sols, no fan historial).
--
-- DES DE QUAN COMPTEN ELS 15 ANYS: l'última sessió de fisioteràpia ja passada
-- (no cancel·lada); si no n'hi ha cap, l'última entrada clínica. Data del centre
-- (Europe/Madrid).
--
-- COMPTES DEMO: s'arxiven igual, marcats `is_demo = true` (decisió d'en Marc,
-- 17/10/2026: així es pot provar de debò sense cap client real). La RLS no
-- barreja mai els mons: un fisio demo només veu arxius demo, i un de real, només
-- reals. L'admin ho veu tot.
--
-- EL CRON NO ÉS AQUÍ: els fitxers del bucket s'han d'esborrar per l'API de
-- Storage (esborrar files de `storage.objects` amb SQL deixaria els fitxers
-- orfes). El fa l'app dins del cron diari que ja existeix (`/api/cron/reminders`:
-- el pla gratuït de Vercel només en permet un), amb `purgeExpiredClinicalArchive`.
--
-- Idempotent: `if not exists`, `create or replace`, `drop … if exists`,
-- `on conflict do nothing`.
-- ============================================================================

-- ─── 1. Taules ───────────────────────────────────────────────────────────────

create table if not exists public.clinical_archive_patients (
  id               uuid primary key,          -- el posa l'app (fa servir el mateix id per a la carpeta del bucket)
  former_client_id uuid not null unique,      -- el client esborrat (sense FK: ja no existeix)
  full_name        text not null,
  birth_date       date,
  email            text,
  phone            text,
  last_care_on     date not null,             -- l'«alta»: última atenció de fisioteràpia
  archived_at      timestamptz not null default now(),
  archived_by      uuid references public.profiles (id) on delete set null,
  archived_by_name text,                      -- foto del nom de qui l'ha arxivat
  is_demo          boolean not null default false
);

comment on table public.clinical_archive_patients is
  'Arxiu clínic: pacients donats de baixa amb historial de fisioteràpia (Llei 21/2000, 0119). Llegeixen admin i fisios; ningú no hi escriu per l''API.';

create table if not exists public.clinical_archive_entries (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.clinical_archive_patients (id) on delete cascade,
  kind               text not null check (kind in ('first_visit', 'followup', 'session_note', 'document', 'consent')),
  body               text,                    -- el text (notes); NULL als documents i consentiments
  author_name        text,                    -- foto del nom de qui ho va escriure o pujar
  written_at         timestamptz not null,    -- quan es va escriure / pujar / donar
  updated_at         timestamptz,
  session_on         timestamptz,             -- notes de sessió: quan va ser la sessió
  source_id          uuid,                    -- id de la fila original
  -- Documents
  storage_path       text,                    -- dins del bucket `clinical-archive`
  file_name          text,
  file_size          integer,
  mime_type          text,
  description        text,
  -- Consentiments
  consent_version    text,
  consent_revoked_at timestamptz,
  -- Fins quan es conserva AQUESTA entrada (avui, 15 anys per a totes).
  purge_after        date not null
);

comment on table public.clinical_archive_entries is
  'Arxiu clínic: el que es conserva de cada pacient (notes, documents, consentiments), cadascun amb el seu termini (0119).';

create index if not exists clinical_archive_entries_patient_idx on public.clinical_archive_entries (patient_id, kind, written_at);
create index if not exists clinical_archive_entries_purge_idx on public.clinical_archive_entries (purge_after);

-- ─── 2. RLS: només llegir ────────────────────────────────────────────────────

alter table public.clinical_archive_patients enable row level security;
alter table public.clinical_archive_entries  enable row level security;

revoke all on public.clinical_archive_patients from anon, authenticated;
revoke all on public.clinical_archive_entries  from anon, authenticated;
grant select on public.clinical_archive_patients to authenticated;
grant select on public.clinical_archive_entries  to authenticated;

drop policy if exists "clinical_archive_patients_select" on public.clinical_archive_patients;
create policy "clinical_archive_patients_select" on public.clinical_archive_patients
  for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or (public.is_physio() and is_demo = public.is_demo_profile(auth.uid()))
  );

drop policy if exists "clinical_archive_entries_select" on public.clinical_archive_entries;
create policy "clinical_archive_entries_select" on public.clinical_archive_entries
  for select to authenticated
  using (exists (select 1 from public.clinical_archive_patients p where p.id = patient_id));

-- ─── 3. Bucket privat ────────────────────────────────────────────────────────
-- Cap política a `storage.objects` per a aquest bucket: amb sessió, ningú no hi
-- llegeix ni hi escriu. Només la clau de servei (l'app, després de comprovar).

insert into storage.buckets (id, name, public, file_size_limit)
values ('clinical-archive', 'clinical-archive', false, 15728640)
on conflict (id) do nothing;

-- ─── 4. Registre d'accessos ──────────────────────────────────────────────────

alter table public.data_access_log
  drop constraint if exists data_access_log_action_check;
alter table public.data_access_log
  add constraint data_access_log_action_check
  check (action in ('export', 'delete', 'clinical_view',
                    'clinical_archive', 'clinical_archive_view', 'clinical_archive_export', 'clinical_purge'));

-- ─── 5. Fins quan es conservaria ─────────────────────────────────────────────

create or replace function public.clinical_retention_for(p_client uuid)
returns table (has_history boolean, is_demo boolean, last_care_on date, purge_after date)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select cl.id, cl.profile_id,
           exists (select 1 from public.demo_profiles d where d.profile_id = cl.profile_id) as demo
      from public.clients cl
     where cl.id = p_client
  ),
  notes as (
    select n.created_at, r.scheduled_at
      from public.session_notes n
      join public.reservations r on r.id = n.reservation_id
     where r.client_id = p_client and r.service_type = 'fisioterapia'
  ),
  last_session as (
    select max(r.scheduled_at) as at
      from public.reservations r
     where r.client_id = p_client
       and r.service_type = 'fisioterapia'
       and r.status <> 'cancelled'
       and r.scheduled_at <= now()
  ),
  last_entry as (
    select greatest(
      (select max(greatest(v.created_at, v.updated_at)) from public.clinical_first_visits v where v.client_id = p_client),
      (select max(greatest(f.created_at, f.updated_at)) from public.clinical_followups f where f.client_id = p_client),
      (select max(created_at) from notes)
    ) as at
  ),
  h as (
    select
      exists (select 1 from public.clinical_first_visits v where v.client_id = p_client)
      or exists (select 1 from public.clinical_followups f where f.client_id = p_client)
      or exists (select 1 from notes) as has_history
  ),
  care as (
    select (coalesce((select at from last_session), (select at from last_entry)) at time zone 'Europe/Madrid')::date as on_day
  )
  select h.has_history,
         c.demo,
         case when h.has_history then care.on_day end,
         case when h.has_history then (care.on_day + interval '15 years')::date end
    from c, h, care
$$;

comment on function public.clinical_retention_for(uuid) is
  'Té historial clínic aquest client, és demo i, si s''arxivés avui, des de quan i fins quan es conservaria (15 anys). Només clau de servei (0119).';

-- ─── 6. Arxivar ──────────────────────────────────────────────────────────────
--
-- Tot o res: si qualsevol insert falla, no queda res arxivat i l'app no esborra
-- el compte. Els documents ja s'han copiat al bucket abans (els passa l'app a
-- `p_documents`: [{source_id, storage_path, file_name, file_size, mime_type,
-- description, uploaded_at}]). Un client demo s'arxiva marcat `is_demo`. Torna
-- un JSON: {archived, reason, patient_id, purge_after, is_demo}.

create or replace function public.archive_clinical_history(
  p_client     uuid,
  p_patient_id uuid,
  p_documents  jsonb,
  p_actor      uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  prof public.profiles;
  actor_name text;
begin
  select * into r from public.clinical_retention_for(p_client);
  if r.has_history is null then
    raise exception 'Aquest client no existeix.' using errcode = 'P0002';
  end if;
  if not r.has_history then
    return jsonb_build_object('archived', false, 'reason', 'none');
  end if;

  select p.* into prof
    from public.profiles p join public.clients c on c.profile_id = p.id
   where c.id = p_client;
  select full_name into actor_name from public.profiles where id = p_actor;

  insert into public.clinical_archive_patients
    (id, former_client_id, full_name, birth_date, email, phone, last_care_on, archived_by, archived_by_name, is_demo)
  values
    (p_patient_id, p_client, coalesce(prof.full_name, '—'), prof.birth_date, prof.email, prof.phone,
     r.last_care_on, p_actor, actor_name, r.is_demo);

  -- Primera visita
  insert into public.clinical_archive_entries
    (patient_id, kind, body, author_name, written_at, updated_at, source_id, purge_after)
  select p_patient_id, 'first_visit', v.body,
         coalesce((select full_name from public.profiles where id = v.created_by), '—'),
         v.created_at, v.updated_at, null, r.purge_after
    from public.clinical_first_visits v
   where v.client_id = p_client;

  -- Seguiments
  insert into public.clinical_archive_entries
    (patient_id, kind, body, author_name, written_at, updated_at, source_id, purge_after)
  select p_patient_id, 'followup', f.body,
         coalesce((select full_name from public.profiles where id = f.author_id), '—'),
         f.created_at, f.updated_at, f.id, r.purge_after
    from public.clinical_followups f
   where f.client_id = p_client;

  -- Notes de sessió de fisioteràpia
  insert into public.clinical_archive_entries
    (patient_id, kind, body, author_name, written_at, updated_at, session_on, source_id, purge_after)
  select p_patient_id, 'session_note', n.body,
         coalesce((select full_name from public.profiles where id = n.author_id), '—'),
         n.created_at, n.updated_at, res.scheduled_at, n.reservation_id, r.purge_after
    from public.session_notes n
    join public.reservations res on res.id = n.reservation_id
   where res.client_id = p_client and res.service_type = 'fisioterapia';

  -- Documents (ja copiats al bucket per l'app)
  insert into public.clinical_archive_entries
    (patient_id, kind, author_name, written_at, source_id, storage_path, file_name, file_size, mime_type, description, purge_after)
  select p_patient_id, 'document', coalesce(prof.full_name, '—'),
         coalesce((d->>'uploaded_at')::timestamptz, now()),
         (d->>'source_id')::uuid, d->>'storage_path', d->>'file_name',
         (d->>'file_size')::integer, d->>'mime_type', d->>'description', r.purge_after
    from jsonb_array_elements(coalesce(p_documents, '[]'::jsonb)) d;

  -- Consentiments de salut (tots: també els retirats)
  insert into public.clinical_archive_entries
    (patient_id, kind, author_name, written_at, source_id, consent_version, consent_revoked_at, purge_after)
  select p_patient_id, 'consent', coalesce(prof.full_name, '—'), k.granted_at, k.id, k.version, k.revoked_at, r.purge_after
    from public.consents k
   where k.user_id = prof.id and k.type = 'health_data';

  insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action, details)
  values (p_actor, prof.id, coalesce(prof.full_name, '—') || ' <' || coalesce(prof.email, '') || '>',
          'clinical_archive', 'Arxivat fins al ' || to_char(r.purge_after, 'DD/MM/YYYY'));

  return jsonb_build_object('archived', true, 'patient_id', p_patient_id, 'purge_after', r.purge_after, 'is_demo', r.is_demo);
end;
$$;

comment on function public.archive_clinical_history(uuid, uuid, jsonb, uuid) is
  'Arxiva l''historial clínic d''un client abans d''esborrar-li el compte (tot o res) i ho anota; un demo, marcat is_demo. Sense historial: no fa res. Només clau de servei (0119).';

-- ─── 7. Purga ────────────────────────────────────────────────────────────────

create or replace function public.clinical_archive_expired(p_today date)
returns table (entry_id uuid, patient_id uuid, storage_path text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.patient_id, e.storage_path
    from public.clinical_archive_entries e
   where e.purge_after < p_today
$$;

comment on function public.clinical_archive_expired(date) is
  'Entrades de l''arxiu clínic vençudes a aquest dia, amb el fitxer (si n''hi ha) per esborrar-lo de Storage abans. Només clau de servei (0119).';

-- Esborra NOMÉS les entrades indicades que de debò han vençut (per si l'app en
-- passés alguna de més), i els pacients que es queden sense cap entrada. Anota
-- una línia per pacient. Torna quantes entrades ha esborrat.
create or replace function public.purge_clinical_archive(p_entry_ids uuid[], p_today date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with gone as (
    delete from public.clinical_archive_entries e
     where e.id = any (p_entry_ids) and e.purge_after < p_today
    returning e.patient_id
  )
  select count(*) into n from gone;

  -- Sense el nom: d'aquest pacient ja no en queda res, i el registre no n'ha de
  -- guardar la identitat. Només l'id de l'arxiu i les dates.
  insert into public.data_access_log (actor_id, subject_profile_id, subject_label, action, details)
  select null, null, 'Arxiu clínic ' || p.id, 'clinical_purge',
         'Purgat per venciment. Arxivat el ' || to_char(p.archived_at, 'DD/MM/YYYY')
         || '; última atenció el ' || to_char(p.last_care_on, 'DD/MM/YYYY') || '.'
    from public.clinical_archive_patients p
   where not exists (select 1 from public.clinical_archive_entries e where e.patient_id = p.id);

  delete from public.clinical_archive_patients p
   where not exists (select 1 from public.clinical_archive_entries e where e.patient_id = p.id);

  return n;
end;
$$;

comment on function public.purge_clinical_archive(uuid[], date) is
  'Esborra de l''arxiu clínic les entrades vençudes indicades i els pacients que es queden buits, i ho anota. Només clau de servei (0119).';

-- ─── 8. Permisos de les funcions: només la clau de servei ────────────────────

revoke execute on function public.clinical_retention_for(uuid)                        from public, anon, authenticated;
revoke execute on function public.archive_clinical_history(uuid, uuid, jsonb, uuid)   from public, anon, authenticated;
revoke execute on function public.clinical_archive_expired(date)                      from public, anon, authenticated;
revoke execute on function public.purge_clinical_archive(uuid[], date)                from public, anon, authenticated;
grant  execute on function public.clinical_retention_for(uuid)                        to service_role;
grant  execute on function public.archive_clinical_history(uuid, uuid, jsonb, uuid)   to service_role;
grant  execute on function public.clinical_archive_expired(date)                      to service_role;
grant  execute on function public.purge_clinical_archive(uuid[], date)                to service_role;
