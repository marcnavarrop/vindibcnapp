-- ============================================================================
-- VindiBCN · 0081 — El fre del restabliment de contrasenya
--
-- `requestPasswordResetAction` és pública, no demana sessió i dispara un correu
-- per Resend contra qualsevol adreça que li passin. No tenia cap fre: ni per
-- destinatari ni per IP. Serveix per omplir la bústia d'un client i per cremar
-- la quota i la reputació d'enviament del centre.
--
-- La incoherència és el que ho delata: la resta del projecte SÍ que es protegeix.
-- Les sessions de prova tenen antiabús per IP (0018) i el canvi de correu té un
-- `cooldown` de 5 minuts (0078). El camí que es va quedar sense res era
-- justament l'únic dels tres del tot anònim.
--
-- PER QUÈ UNA TAULA I NO `notification_log`
--
-- Perquè el que s'ha de comptar són les PETICIONS, no els enviaments. És
-- exactament el que ja diu la 0078 sobre aquest mateix problema: "el cooldown
-- es mira sobre les peticions, no sobre el log d'enviaments, perquè una petició
-- compta encara que el correu no hagi arribat a sortir".
--
-- I aquí encara hi ha una segona raó, més forta: `sendPasswordRecovery` surt en
-- SILENCI quan l'adreça no té compte —a posta, per no revelar qui és client del
-- centre— i per tant no escriu res al log. Amb `notification_log` com a font,
-- qui provés mil adreces a l'atzar no trobaria cap fre, perquè cap d'aquelles
-- mil hauria deixat rastre.
--
-- QUÈ ES DESA, I QUÈ NO
--
-- Només SHA-256. Ni el correu ni l'adreça IP en clar.
--
-- Per a un fre només cal saber si dues peticions són la mateixa, i això un hash
-- ho respon igual de bé. Guardar-ho en clar voldria dir acumular una llista de
-- correus tecleats per visitants anònims —gent que pot no tenir cap relació amb
-- el centre— i una d'adreces IP, que és dada personal. Mateix criteri que la
-- 0078 amb el secret de l'enllaç: es desa el hash perquè qui llegís la taula no
-- en tregui res que no tingués ja.
--
-- RLS: TANCADA DEL TOT
--
-- S'activa la RLS i no es crea CAP política, com a la 0078. Sense polítiques no
-- hi passa ni `anon` ni `authenticated`, i l'únic que hi arriba és el servidor
-- amb la clau de servei. El navegador no hi té res a fer: si pogués llegir-la,
-- sabria quins correus s'han provat.
-- ============================================================================

create table if not exists public.password_reset_requests (
  id         uuid primary key default gen_random_uuid(),
  -- SHA-256 (hex) del correu normalitzat (retallat i en minúscules).
  email_hash text not null,
  -- SHA-256 (hex) de la IP. Null si el proxy no l'ha donada.
  ip_hash    text,
  created_at timestamptz not null default now()
);

comment on table public.password_reset_requests is
  'Peticions de restabliment de contrasenya, per frenar-ne l''abús (0081). Només hashes: mai el correu ni la IP en clar.';
comment on column public.password_reset_requests.email_hash is
  'SHA-256 del correu normalitzat. Serveix per comparar, no per saber qui és.';

-- Les dues preguntes que fa el fre, i cap més: "quantes n'hi ha hagut d'aquest
-- correu des de fa X" i "quantes d'aquesta IP des de fa X". Les dues van per
-- igualtat + finestra de temps, que és el que cobreixen aquests índexs.
create index if not exists password_reset_requests_email_idx
  on public.password_reset_requests (email_hash, created_at desc);

create index if not exists password_reset_requests_ip_idx
  on public.password_reset_requests (ip_hash, created_at desc)
  where ip_hash is not null;

-- Per a l'escombrat diari, que esborra el que ja no serveix per frenar res.
create index if not exists password_reset_requests_created_idx
  on public.password_reset_requests (created_at);

alter table public.password_reset_requests enable row level security;

-- Cap política, a posta: només la clau de servei (que se salta la RLS).
-- El `revoke` va davant igual que a la 0061/0065/0077/0078: no depenem que
-- PostgREST segueixi decidint demà el mateix que avui.
revoke all on public.password_reset_requests from public;
revoke all on public.password_reset_requests from anon;
revoke all on public.password_reset_requests from authenticated;
