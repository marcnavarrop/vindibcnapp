-- ============================================================================
-- VindiBCN · 0078 — La sol·licitud de canviar el correu d'accés, guardada
--
-- El client podrà demanar el canvi del seu correu d'accés des de Configuració.
-- Aquesta taula guarda la petició mentre espera que la confirmin des de la
-- bústia NOVA. Existeix per una raó molt concreta, i val la pena escriure-la
-- perquè no sembli una taula de més.
--
-- PER QUÈ NO N'HI HA PROU AMB EL TOKEN DE SUPABASE A L'ENLLAÇ
--
-- La resta de correus de compte (invitació i recuperació) porten l'enllaç a
-- `/auth/update-password?token_hash=…`, una PÀGINA que verifica el token amb
-- JavaScript. Es va fer així perquè els escànegers d'enllaços dels proveïdors
-- de correu fan un GET pla, sense executar JS, i així no cremen un token d'un
-- sol ús abans que la persona cliqui.
--
-- Amb el canvi de correu aquest patró NO es pot repetir. Comprovat contra el
-- projecte real, sis maneres de verificar el mateix token —el token seguia viu,
-- perquè la sisena va funcionar—:
--
--   POST /verify {type:'email_change',     token_hash}          → 403 otp_expired
--   POST /verify {type:'email_change_new', token_hash}          → 400 tipus invàlid
--   POST /verify {type:'email_change', token, email: nou}       → 403 otp_expired
--   POST /verify {type:'email_change', token, email: vell}      → 403 otp_expired
--   GET  /verify?token_hash=…&type=email_change                 → 400
--   GET  /verify?token=<cru>&type=email_change                  → 303, canvi FET
--
-- És a dir: `supabase.auth.verifyOtp()` no accepta els tokens de canvi de
-- correu. L'únic camí que funciona és el GET amb el token cru, que és
-- exactament el que un escàner de correu dispararia tot sol.
--
-- QUÈ GUARDA, I QUÈ NO
--
-- L'enllaç del correu porta un secret NOSTRE, no el de GoTrue. D'aquest secret
-- aquí només se'n desa el SHA-256: si algú arribés a llegir la taula, no en
-- trauria res que serveixi per completar cap canvi. El token de GoTrue no es
-- desa enlloc —s'encunya de nou amb `generateLink` en el moment de confirmar,
-- que és quan es fa servir—, així que aquesta taula no conté cap secret viu.
--
-- La fila és la CAPACITAT: qui té el secret que hi encaixa és qui va rebre el
-- correu a la bústia nova, i això és precisament el que voliem demostrar.
--
-- RLS: TANCADA DEL TOT
--
-- S'activa la RLS i no es crea CAP política. No és un descuit: sense polítiques
-- no hi passa ni `anon` ni `authenticated`, i l'únic que hi arriba és el
-- servidor amb la clau de servei, que se salta la RLS per disseny. És la taula
-- més sensible del projecte —qui hi escriu decideix amb quin correu s'entra— i
-- no hi ha cap cas d'ús en què el navegador l'hagi de tocar.
-- ============================================================================

create table if not exists public.email_change_requests (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  -- El correu demanat. Es desa perquè la confirmació ha de saber cap a on va
  -- sense refiar-se de res que vingui de l'enllaç.
  new_email   text not null,
  -- SHA-256 (hex) del secret que viatja a l'enllaç. Mai el secret en clar.
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  -- Marca de consumida O d'anul·lada: una petició nova anul·la les anteriors
  -- del mateix perfil, de manera que només l'últim enllaç enviat funciona.
  consumed_at timestamptz
);

-- Per buscar les pendents d'un perfil: el `cooldown` i l'anul·lació de les
-- anteriors hi passen a cada petició.
create index if not exists email_change_requests_profile_idx
  on public.email_change_requests (profile_id, consumed_at);

comment on table public.email_change_requests is
  'Peticions de canvi de correu d''accés pendents de confirmar des de la bústia nova (0078).';
comment on column public.email_change_requests.token_hash is
  'SHA-256 del secret de l''enllaç. El secret en clar només viatja al correu.';

alter table public.email_change_requests enable row level security;

-- Cap política, a posta: només la clau de servei (que se salta la RLS).
-- El `revoke` va davant igual que a la 0061/0065/0077: no depenem que
-- PostgREST segueixi decidint demà el mateix que avui.
revoke all on public.email_change_requests from public;
revoke all on public.email_change_requests from anon;
revoke all on public.email_change_requests from authenticated;
