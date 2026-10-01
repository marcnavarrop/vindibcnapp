# VindiApp — visió tècnica per a un revisor

Aquest document no és documentació d'usuari ni de negoci: és una orientació
ràpida per a algú que llegirà el codi directament. Explica l'arquitectura
general i assenyala, amb noms de fitxer i de migració, els llocs on hi ha
decisions d'enginyeria que val la pena mirar de prop. Per posar-ho en marxa, el
[README](../README.md).

## Què és

Eina de gestió per a un centre boutique d'entrenament personal i fisioteràpia
(Barcelona): clients, bons, reserves (individuals, en parella i de grup) i
sèries, llista d'espera, sessions de prova públiques, subscripcions mensuals,
pagaments amb Stripe, liquidacions i bonus dels professionals, exercicis,
comunitat i tres rols amb permisos molt diferenciats (admin / professional /
client).

## Stack

- Next.js 15 (App Router, TypeScript, Server Actions), desplegat a Vercel
  (funcions a `dub1`).
- Supabase: Postgres + Row Level Security + Auth + Storage, eu-west-1.
- Stripe: Checkout (pagament únic) + Subscriptions (subscripcions de grup).
- Resend: tot el correu transaccional, mai el mailer intern de Supabase.
- Tailwind CSS, sense cap framework de components pesat.

**100 migracions SQL** a `supabase/migrations/` (`0001`–`0100`), numerades i
aplicades a mà per en Marc, mai per l'agent d'IA que ha construït gran part del
projecte: és una norma explícita del flux de treball. El codi que en depèn no
s'apuja fins que la migració és a producció.

## Arquitectura general

Tres àrees separades per rol dins del mateix App Router (`app/(admin)`,
`app/(trainer)`, `app/(client)`), més les pàgines públiques (`app/prova`,
`app/legal`, `app/(auth)`). `middleware.ts` fa de porta d'entrada: llegeix la
sessió de Supabase, comprova el rol a `profiles` i talla qualsevol accés fora de
l'àrea corresponent. La identitat validada arriba al render en capçaleres
**signades amb HMAC** (`lib/auth-headers.ts`), i `getViewer()` (`lib/auth.ts`) no
se les creu si la firma no quadra.

L'àrea del client i les pàgines públiques són trilingües (ca/es/en,
`messages/*.json` + `next-intl`); admin i professional van en català fix, una
decisió deliberada. Els correus segueixen la mateixa regla: l'idioma surt del
perfil de qui els rep.

La capa de dades (`lib/data/`) és qui sap què es pot fer. Fa servir el client de
sessió (subjecte a la RLS) o la clau de servei, segons el cas; la clau de servei
només s'usa al servidor i sempre darrere d'una comprovació de rol (vegeu més
avall). Les regles que han de dir el mateix a la pantalla i al servidor són
mòduls purs a `lib/` (`booking-scope.ts`, `free-slots.ts`, `occupancy.ts`,
`demo-accounts.ts`…), sense `server-only`, perquè el calendari no ensenyi el que
el servidor rebutjaria.

## El model de seguretat

### La RLS com a frontera, i dues portes més

Qui pot veure o tocar una fila ho decideix Postgres; l'aplicació hi ajuda
(amagant botons, filtrant llistes), però no és l'única barrera. Com que la capa
de dades també escriu amb la clau de servei, que salta la RLS, hi ha dues portes
més al codi:

- **`requireRole(...)`** (`lib/auth.ts`) a la primera línia de cada acció de
  servidor no pública. Una Server Action es pot invocar pel seu id des de
  qualsevol pàgina amb un POST: el middleware de `/admin/*` no la protegeix.
- **`scripts/actions-check.mjs`** (`npm run actions:check`, corre a cada
  `prebuild`): llegeix cada fitxer `"use server"` amb el compilador de
  TypeScript i fa fallar el build si alguna funció exportada no crida
  `requireRole`/`getViewer` i no és a `scripts/public-actions.json` amb el motiu.
  Avui: **156 accions, 149 amb comprovació i 7 públiques a propòsit** (registre,
  contrasenya, sessió de prova…). `npm run roles:check` comprova, en simulació,
  que la condició és la bona (p. ex. un professional, només per als seus
  clients).

### Coses concretes a mirar

- **Dues escalades a admin, tapades** (`0063`, `0064`): un trigger `BEFORE
  UPDATE` a `profiles` que impedeix que ningú s'autoatorgui `role='admin'`, i
  `handle_new_user()` reescrit perquè el metadata públic del registre mai
  decideixi el rol d'un compte nou.
- **`session_notes`** (`0079`): l'escriu només el professional d'AQUELLA reserva
  (`is_session_trainer`, no `is_trainer_of`), la llegeix ell, el client i
  l'admin, i explícitament no la resta de professionals del mateix client, amb
  un comentari a la mateixa migració advertint que afegir-hi la clàusula de
  coordinació «per coherència» desfaria l'única raó de ser de la taula.
- **`email_change_requests`** (`0078`): RLS activada, cap política i `revoke all`
  a `public`, `anon` i `authenticated`. Cap sessió hi arriba; només el servidor,
  amb la clau de servei. La taula desa el secret de l'enllaç **només en hash**.
- **`revoke` abans del `grant`** a les funcions `SECURITY DEFINER` des de la
  `0061`/`0065`: Postgres dona l'execució a `PUBLIC` per defecte, i a més hi pot
  haver un grant directe a `anon`; no es confia que el comportament per defecte
  de PostgREST segueixi sent el mateix demà.
- **`coalesce(public.is_admin(), false)`** a les comprovacions d'admin de les
  funcions (`0063`, `0095`, `0096`, `0097`): `is_admin()` torna `NULL` quan no hi
  ha perfil (la clau de servei, una sessió estranya), i `if not NULL` no entra.
  Es va trobar en una funció ja aplicada i es va corregir amb una migració pròpia
  (`0096`); des d'aleshores va des del principi.
- **Bloqueig d'aforament de grup** (`book_group_slot`, `0053`, refeta a la
  `0070`): `pg_advisory_xact_lock` sobre `(trainer_id, scheduled_at)` per evitar
  sobrevendre l'última plaça amb dues reserves alhora. L'ocupació no depèn del
  bo, així que les sessions de cortesia (`0070`) hi entren igual. El mateix patró
  serialitza les sessions extra d'una subscripció (`0073`).
- **Anuncis només de l'admin** (`0098`): la política d'escriptura deixava
  editar a qualsevol professional; ara insert/update/delete només admin.
- **Comptes demo separats dels reals** (`lib/demo-accounts.ts`): mentre
  l'Entrenador Demo, el Fisio Demo i el Client Demo visquin a producció, la regla
  «demo amb demo, real amb real» és dins de `clientBookingScope`
  (`lib/booking-scope.ts`), amb la fitxa del client com a paràmetre
  **obligatori**: el compilador assenyala qualsevol camí que se n'oblidi. Cobreix
  reservar, la cua, les sèries i la promoció; el calendari del client i `/prova`
  no reben res dels demo (tampoc l'ocupació, que és pública), i l'equip tampoc
  els pot creuar (`createReservation`). El pla és treure'ls a un entorn PRE
  separat.

## Integritat financera

- **Idempotència via índexs únics parcials, no lògica d'aplicació** (`0054`,
  `0072`): `stripe_checkout_session_id` a bons i vals, `stripe_payment_id` a
  pagaments, i a les subscripcions una sola de viva per client i un bo per cicle
  o per factura. Un webhook duplicat o un doble clic xoca contra la restricció i
  torna `23505`, que el webhook llegeix com «ja estava fet» i respon `200`.
- **Cobrar un bo és tot o res** (`markBonoPaid`, `lib/data/bonos.ts`): si
  l'actualització no canvia exactament una fila (cobrat alhora des d'una altra
  pestanya, o la RLS no el deixa tocar), falla i no anota el pagament. Abans
  s'anotava igualment. `npm run paid:check` ho prova per la branca real contra un
  Supabase de memòria (`scripts/shims/fake-supabase.ts`).
- **Els totals els calcula la base**: `payments_summary`, `payments_by_month`
  (`0095`) i `bonos_summary` (`0097`), només per a l'admin. Sumar al navegador
  es trencava en passar de 1000 files.
- **Subscripcions natives de Stripe, no reconstruïdes a mà** (`0072`–`0076`):
  l'app no desa cap `Customer`/`PaymentMethod`, i fer cobrament off-session a mà
  hauria volgut dir reimplementar reintents, 3DS i dunning.
- **Pausa de subscripció amb `trial_end`** (`lib/data/subscription-pause.ts`), no
  amb l'endpoint natiu de pausa (exigeix una versió d'API *preview* i el
  *flexible billing mode*) ni amb `pause_collection` (deixa la subscripció
  activa i no atura el rellotge). Límit conegut: `trial_end` admet com a molt dos
  anys.

## El sostre de 1000 files

Supabase talla cada resposta a 1000 files sense avisar. Tres peces:

- **`scripts/row-limit-check.mjs`** (`npm run rows:check`, a cada `prebuild`):
  cada `.from(…).select(…)` sense `.limit`/`.range`/`.single`/`head` ha de ser a
  `scripts/row-limit-allowlist.json` com a `acotada` (filtrada per id, client,
  finestra…) o `pendent` (creix amb el centre). Avui: 115 entrades, 102 acotades
  i 13 pendents. Una lectura nova sense anotar fa fallar el build.
- **Les llistes que creixen van per pàgines** (pagaments, clients, bons, històric
  de proves), amb cursor i comptadors de la base; **les lectures que han de ser
  completes** (l'ocupació del calendari, `/prova` i les sèries; els destinataris
  d'un correu) van amb finestra i `fetchAllRows` (`lib/supabase/fetch-all.ts`).
- **`lib/supabase/row-cap.ts`** deixa un avís als registres a partir de 500
  files i quan s'arriba al sostre: és el senyal per paginar una llista `pendent`.

## Altres decisions de les últimes setmanes

- **Una sola ocupació** (`lib/occupancy.ts`): l'Inici, la tira de la setmana i el
  mode «Setmana» de l'agenda compten igual (mitges hores d'horari sense bloquejar
  cobertes per una sessió reservada o feta; un grup compta l'hora sencera). Abans
  la tira i l'Inici donaven xifres diferents el mateix dia.
- **El correu de la comunitat** (`lib/notifications/community.ts`): cada
  destinatari queda `queued` al `notification_log` en publicar, i l'enviament va
  a `after()` en lots de 100 (`/emails/batch`), amb clau d'idempotència per lot.
  Un 429 de velocitat es reintenta; la quota diària esgotada deixa la resta com a
  `failed` amb el motiu. L'admin veu «Correu: enviat a N de M».
- **El contacte del centre és una dada, no codi** (`0100`, Configuració →
  Centre): manual, pantalles, peu dels correus, pàgines legals i val de regal en
  surten. El remitent dels avisos no es llegeix: el `Reply-To` és el correu de
  contacte i **només si n'hi ha**; sense, cap correu convida a respondre.
- **Canvi de correu propi** (`0077`–`0078`, `lib/data/email-change.ts`):
  `supabase.auth.updateUser({ email })` envia al correu VELL un enllaç viu que
  completa el canvi amb un sol clic (comprovat contra el projecte real). Aquí
  l'enllaç va només al correu nou, el vell rep un avís sense acció, i el token de
  GoTrue s'encunya i es gasta al servidor perquè `verifyOtp` no accepta els de
  canvi de correu. L'admin el pot iniciar per a un professional
  (`requestEmailChangeByAdmin`), amb la mateixa confirmació a la bústia nova.
- **El mode PRE** (`lib/pre-mode.ts`): l'admin salta entre els comptes demo amb
  una sessió de veritat (`generateLink` + `verifyOtp` al servidor), no amb un
  «veure com si fos», que hauria obligat a fabricar capçaleres d'identitat; el
  camí de tornada restaura el refresh token de l'admin des d'una galeta xifrada.
  Amb el mode armat, l'exportació i l'esborrat RGPD queden bloquejats.

## Disciplina de verificació

- **Comprovacions en simulació** (`npm run *:check`, una vintena llarga; vegeu el
  README): el mode simulació (`lib/mock/`) permet provar camins sencers sense
  base. Quan cal provar la branca REAL, un Supabase de memòria
  (`scripts/shims/fake-supabase.ts`) substitueix els clients.
- **Lectura contra producció** per confirmar dades i consultes reals, sempre en
  mode de només lectura. Quan una prova ha d'escriure a producció, es fa amb un
  guió revisat abans, foto d'abans i després, i neteja sempre per **id exacte**,
  mai per patró.
- **Migracions assajades** a PGlite (Postgres en WASM) amb els casos bons i
  dolents abans d'aplicar-les, i la RLS provada al SQL Editor fent-se passar per
  un usuari dins d'una transacció amb `rollback`.
- Diversos bugs reals només van sortir provant amb una sessió de veritat, no
  llegint el codi: per exemple, `supabase.auth.signOut()` sense arguments val
  `scope: "global"` i revoca totes les sessions de l'usuari
  (`lib/data/reauth.ts`), o `verifyOtp` rebutjant els seus propis tokens de canvi
  de correu (`0078`).

## Estructura del repositori

```
app/(admin)|(trainer)|(client)/   rutes per rol, protegides per middleware.ts
app/prova, app/legal, app/(auth)  pàgines públiques (traduïdes)
lib/data/                          capa de dades (sessió o clau de servei, sempre darrere de requireRole)
lib/*.ts                           regles pures compartides per pantalla i servidor
lib/help/                          els 3 manuals d'usuari, com a dades i no com a JSX
lib/notifications/                 avisos: plantilles, log, correu, comunitat
lib/mock/                          el mode simulació
supabase/migrations/               100 fitxers SQL numerats, aplicats a mà
messages/{ca,es,en}.json           i18n del client i les pàgines públiques
scripts/                           comprovacions (*:check) i eines de suport
docs/                              aquest document, EMAILS.md i la guia de proves
```
