-- ============================================================================
-- VindiBCN · 0118 — Consentiment de salut v2026-10: versió nova i es pot retirar
--
-- Decisió d'en Marc, amb els textos validats per l'assessor (17/10/2026):
--
--   · Un sol consentiment de salut (tests d'avaluació i mesures corporals +
--     seguiment de fisioteràpia), versió 2026-10, que es demana a TOTS els
--     clients. Qui té la versió anterior l'ha de tornar a acceptar; mentrestant,
--     els seus tests es consulten però no se n'hi poden afegir de nous.
--   · El client el pot RETIRAR des del seu perfil, igual de fàcil que donar-lo.
--
-- QUÈ CANVIA A LA BASE
--
--   1. `consents.revoked_at`: quan es va retirar. Retirar no esborra la fila
--      (la data i la versió de quan es va donar són la prova del consentiment);
--      només la marca. Tornar-lo a donar n'afegeix una de nova.
--   2. `revoke_health_consent()`: el propi usuari retira el SEU consentiment de
--      salut (totes les files vigents). SECURITY DEFINER perquè `consents` no té
--      cap política d'UPDATE: ningú no hi pot tocar res més. Torna quantes n'ha
--      retirat.
--   3. `health_consent_status(client)`: el més recent NO retirat. Ho fan servir
--      la fitxa i l'historial clínic: un consentiment retirat ja no hi surt com a
--      signat.
--   4. `client_tests_consent_ok(client)` (0117): ara demana la versió 2026-10 o
--      posterior. Amb la 2026-06, els tests es llegeixen, s'editen i s'esborren,
--      però no se n'hi creen de nous ni s'hi afegeixen registres.
--
-- Les versions són «AAAA-MM»: es comparen com a text.
--
-- L'historial clínic NO canvia: no bloqueja sense consentiment (només n'avisa,
-- 0110), i la seva base legal per a la fisioteràpia és l'art. 9.2.h RGPD.
--
-- Idempotent: `add column if not exists` i `create or replace`.
-- ============================================================================

-- 1. Retirada ----------------------------------------------------------------------

alter table public.consents add column if not exists revoked_at timestamptz;

comment on column public.consents.revoked_at is
  'Quan l''usuari el va retirar (0118). NULL = vigent. Retirar no esborra la fila: és la prova de quan es va donar.';

-- 2. Retirar el propi consentiment de salut ---------------------------------------

create or replace function public.revoke_health_consent()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'Cal una sessió per retirar el consentiment.' using errcode = '42501';
  end if;
  update public.consents
     set revoked_at = now()
   where user_id = auth.uid()
     and type = 'health_data'
     and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.revoke_health_consent() is
  'L''usuari amb sessió retira el SEU consentiment de dades de salut (0118). Torna quantes files ha marcat.';

revoke execute on function public.revoke_health_consent() from public, anon;
grant  execute on function public.revoke_health_consent() to authenticated;

-- 3. L'estat: el més recent no retirat ----------------------------------------------

create or replace function public.health_consent_status(p_client uuid)
returns table (granted_at timestamptz, version text)
language sql
stable
security definer
set search_path = public
as $$
  select c.granted_at, c.version
  from public.consents c
  join public.clients cl on cl.profile_id = c.user_id
  where cl.id = p_client
    and c.type = 'health_data'
    and c.revoked_at is null
    and (
      coalesce(public.is_admin(), false)
      or (
        (public.is_physio() or public.is_trainer_of(p_client))
        and public.same_world(p_client)
      )
    )
  order by c.granted_at desc
  limit 1
$$;

comment on function public.health_consent_status(uuid) is
  'Consentiment de dades de salut d''un client: data i versió del més recent NO retirat (0118), o cap fila. Només per a qui pot llegir el seu historial clínic (0110).';

-- 4. Els tests demanen la versió 2026-10 --------------------------------------------

create or replace function public.client_tests_consent_ok(p_client uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.health_consent_status(p_client) h
     where h.version >= '2026-10'
  )
$$;

comment on function public.client_tests_consent_ok(uuid) is
  'Es poden crear tests d''avaluació per a aquest client: té vigent el consentiment de salut 2026-10 o posterior (0117, 0118).';
