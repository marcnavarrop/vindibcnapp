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

**123 migracions SQL** a `supabase/migrations/` (`0001`–`0123`), numerades i
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
  Avui: **157 accions, 150 amb comprovació i 7 públiques a propòsit** (registre,
  contrasenya, sessió de prova…). `npm run roles:check` comprova, en simulació,
  que la condició és la bona (p. ex. un professional, només per als seus
  clients).

### Vídeos d'exercicis: pujada directa a Storage

El vídeo no passa per Vercel (que talla les peticions a 4,5 MB). Una acció
(`requestExerciseVideoUploadAction`, només professional o admin) comprova la
mida i el tipus declarats i dona un permís signat de pujada (`createSignedUploadUrl`,
un sol camí a `pending/`, sense sobreescriure, caduca a les 2 h); el navegador hi
fa el PUT amb barra de progrés. En desar l'exercici, `finalizePendingVideo`
comprova el fitxer de debò (mida i tipus segons Storage) i el mou a la carpeta
de l'exercici. El cron diari esborra el que porta més d'un dia a `pending/`. El
límit és a un sol lloc: `MAX_VIDEO_MB` a `lib/exercise-video.constants.ts`. Cap
migració: el permís el signa la clau de servei.

### Documents del client: pujada directa amb la sessió del client

Com els vídeos, el fitxer no passa per Vercel, però aquí **sense clau de
servei**: poden ser documents de salut i la frontera ha de seguir sent la RLS.
`prepareDocumentUploadAction` dona el camí dins de `{client_id}/`; el navegador
hi fa el POST amb el token de la sessió del client, i la política
`storage_client_documents_insert` (0025) només el deixa escriure a la seva
carpeta. `registerDocumentAction` comprova el fitxer a Storage (mida i tipus de
debò) i insereix la fila també amb la sessió (`client_documents_insert`). El cron
esborra els fitxers de més d'un dia sense fila (`cleanupOrphanDocuments`). Límit:
`DOCUMENT_MAX_MB` (15) a `lib/documents.ts`.

### Capçaleres de seguretat

`next.config.ts` (`headers()`) les posa a totes les respostes: `X-Frame-Options:
DENY` (cap web aliena pot posar l'app en un iframe), `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, una
`Permissions-Policy` que tanca càmera, micròfon, geolocalització i pagament del
navegador, i sense `x-powered-by`. La **CSP bloqueja** des del 17/10/2026 (del
13/10 fins llavors, en Report-Only; es va activar després d'una passada amb
Playwright sense cap avís). Orígens permesos: Supabase (API i Storage),
YouTube sense galetes (vídeos d'exercicis), vercel.live (previsualitzacions) i,
com a destí de formulari, Stripe Checkout i el portal (`billing.stripe.com`);
`frame-ancestors 'none'`. El que bloqueja arriba igualment a
`app/api/csp-report` i queda als registres de Vercel com a `[csp] …`.

**Tornar enrere en un pas:** a `next.config.ts`, `const CSP_ENFORCE = true;` →
`false`. La capçalera passa a `Content-Security-Policy-Report-Only` (avisa i no
bloqueja) amb la mateixa política, i `frame-ancestors` en surt (en Report-Only
no fa res); `X-Frame-Options: DENY` continua protegint dels iframes.

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
- **Què reserva un professional per a un client que no és seu** (`0107`,
  `staffBookingScope` a `lib/booking-scope.ts`): els seus clients, tot (també a
  l'agenda d'un company: és coordinació); la resta, un grup de qualsevol
  professional o la seva especialitat a la seva agenda, sempre amb bo. La regla
  és pura i la fan servir la pantalla i `assertMayBookFor`. Cancel·lar i marcar
  feta tenen porta a la base: `cancel_reservation` obre qualsevol plaça de grup,
  i `complete_reservation` (nova) deixa marcar feta una sessió de la pròpia
  agenda sense obrir la RLS `FOR ALL` de `reservations`. «Demo amb demo» el
  torna a mirar l'app (`assertTeamMayTouch`): la base no sap quins comptes són
  demo. `npm run staffscope:check`.
- **Bons de grup a qualsevol client** (`0108`): qualsevol professional pot
  crear un bo de GRUP a qualsevol client real. La política és només d'INSERT i
  fixa com ha de ser el bo (paquet de grup actiu i no només per subscripció,
  nou, sense Stripe, subscripció ni val, amb les sessions del paquet i el preu
  del catàleg: el del paquet o el que en dona una oferta activa, calculat com
  `computeEffectivePrice`, arrodonit a euros); `bonos_trainer_write` (0005,
  FOR ALL dels clients assignats) no es toca. La resta de bons i les mensualitats,
  només els propis.
- **Bons de fisio a qualsevol client** (`0109`): el fisio és transversal (no
  s'assigna al client). Un professional amb especialitat `fisioterapeuta` pot
  crear un bo de FISIO a qualsevol client, amb el mateix control que la 0108
  (paquet de fisio actiu i no només per subscripció, sessions del paquet, preu
  del catàleg o d'una oferta activa), però neix **pendent de pagament**: no pot
  regalar sessions a un client que no és seu. És una política a part
  (`bonos_physio_insert_physio`); la 0108 no es toca.
- **Historial clínic** (`0110`, tiquet d'en Sergi): taules pròpies
  `clinical_first_visits` (una per client), `clinical_followups` (data, autor,
  text) i `clinical_seen` (l'última vegada que cada professional l'ha obert, per
  a l'avís de novetat). Llegeixen l'admin, qualsevol fisio (`is_physio()`) i
  l'entrenador assignat; escriuen l'admin i els fisios; un seguiment l'edita
  només el seu autor o l'admin; esborrar, només l'admin. El client, res (sí a
  l'exportació RGPD). Els triggers fixen `client_id`, autor i `created_at`.
  Des de la `0115`, l'autor només pot passar a NULL si el seu perfil ja no
  existeix (`clinical_keep_author`, amb `profile_exists` SECURITY DEFINER): és
  el `on delete set null` en donar de baixa un professional. Abans, el trigger
  el desfeia (seguiments orfes, i esborrar algú amb una primera visita fallava
  amb 23503). Un UPDATE que no canvia el text no toca la data d'edició.
  Proves: `supabase/tests/0115_clinical_*.sql` (comprovat a producció abans i
  després). La `0116` treu el NOT NULL de `exercise_progress.recorded_by` i
  `client_documents.uploaded_by`, que eren alhora `on delete set null`: esborrar
  un professional amb progrés registrat fallava (23502). Ara el registre es
  queda sense autor; l'app no l'ensenya enlloc i el tipus admet null.
  Proves: `supabase/tests/0116_author_nullable*.sql`.
  **«Demo amb demo» també a la base**: `demo_profiles` (sense accés per a
  `authenticated`) i `same_world(client)` a totes les polítiques de l'historial
  i a `health_consent_status(client)`, que diu si hi ha consentiment de salut i
  quan als qui poden llegir l'historial. Cada obertura d'un no admin queda a
  `data_access_log` (`clinical_view`), llevat del Client Demo. La regla pura,
  per a pantalla i accions: `lib/clinical-access.ts`. `npm run clinical:check`.
  Les `clients.clinical_notes` (0 a producció) s'hi van copiar; la `0111` va
  buidar la columna i la va esborrar (comprovant abans que cap nota s'hagués
  quedat sense la seva «Primera visita»).
- **Pauta per dies** (`0112`, tiquet d'en Raul): `client_workout_days` (dies
  per client, en cicle, amb nom opcional; el número que es veu surt de l'ordre),
  i a `client_exercises` el dia (`day_id`, nul = «Sense dia»), l'ordre
  (`position`) i la pauta opcional (`sets`, `reps`, `load`, `rest_seconds`).
  `client_workout_logs` és el «Dia fet»: el marca només el client, per a ell,
  amb data d'avui a Madrid, i el desmarca el mateix dia; la base hi posa la foto
  del dia (nom i número). RLS amb el patró de `client_exercises` més
  `same_world`. Moure de dia, reordenar i duplicar són funcions SECURITY
  INVOKER; **el progrés penja de l'assignació**, així que moure un exercici és
  canviar-li el `day_id` (mai treure'l i tornar-lo a posar), i esborrar un dia
  passa els seus exercicis a «Sense dia». `npm run workout:check`.
- **Tests d'avaluació** (`0113`, tiquet d'en Raul): `client_tests` (títol lliure
  únic per client sense mirar majúscules, unitat, descripció, `better_when`
  up/down/neutral, ordre) i `client_test_entries` (data no futura, un valor
  `numeric(12,3)`, observació). Sense catàleg: el test és del client. El
  `client_id` del registre el posa el trigger a partir del test, i una clau
  forània composta `(test_id, client_id)` el lliga. RLS: llegeixen l'admin, el
  professional ASSIGNAT i el client; escriuen l'admin i l'assignat; sempre
  `same_world`. **Tota la regla viu a `client_tests_can_read` i
  `client_tests_can_write`**: si l'assessor diu que són dades de salut, es
  reescriuen aquestes dues funcions sense tocar taules ni polítiques.
  `client_test_suggestions()` (SECURITY DEFINER) dona títol, unitat i usos del
  centre, del mateix món, sense client ni valors. Gràfica SVG pròpia
  (`components/client-tests/test-visuals.tsx`). `npm run tests:check`; RLS a
  `supabase/tests/0113_client_tests_rls.sql` (31 ✓, passades per en Marc al SQL Editor).
  La `0114` hi afegeix dues polítiques NOMÉS DE LECTURA per als fisios
  (`is_physio()` i `same_world`): veuen els tests de qualsevol client, com el
  seu accés transversal de la 0109, i no hi escriuen. A la fitxa del
  professional, la pestanya «Tests» surt en lectura per al fisio que no és
  l'assignat. Proves: `supabase/tests/0114_client_tests_physio_read_rls.sql`.
  La `0117` els tracta com a **dades de salut** (decisió d'en Marc, 17/10/2026):
  CREAR un test o un registre demana el consentiment de salut del client
  (dues polítiques RESTRICTIVES d'INSERT, `client_tests_consent_ok`, que
  pregunta a `health_consent_status`); llegir, editar i esborrar no. A la
  pestanya, sense consentiment, l'avís i cap «+». L'historial clínic NO bloqueja
  sense consentiment (només n'avisa, 0110). Pendent de l'assessor: el text del
  consentiment parla només de fisioteràpia. Proves:
  `supabase/tests/0117_client_tests_consent_rls.sql` (46 ✓).
  La `0118` porta el **consentiment de salut 2026-10** (textos validats per
  l'assessor): un sol consentiment per a tests, mesures i fisioteràpia, demanat
  a tots els clients (targeta a l'Inici fins que l'acceptin;
  `/client/consentiment` amb el text sencer). Versió pròpia,
  `CURRENT_HEALTH_CONSENT_VERSION` a `lib/consent.ts` (la de privacitat segueix
  a part). `consents.revoked_at` i `revoke_health_consent()`: el client el
  retira des de la mateixa pàgina; la fila es queda com a prova.
  `health_consent_status` ignora els retirats i `client_tests_consent_ok` demana
  la 2026-10 o posterior. Proves: `supabase/tests/0118_health_consent_rls.sql`
  (19 ✓).
- **Arxiu clínic** (`0119`, decisió d'en Marc del 17/10/2026 amb els criteris
  més conservadors; Llei 21/2000, art. 12). Quan l'admin elimina un client amb
  historial de fisioteràpia (primera visita, seguiments o notes de sessió de
  fisio), `deleteClient` (`lib/data/gdpr-delete.ts`) l'ARXIVA ABANS d'esborrar
  res: `archiveClinicalHistory` (`lib/data/clinical-archive.ts`) copia els
  documents del client al bucket privat `clinical-archive` (`{patient_id}/…`,
  sense cap política: només la clau de servei) i crida
  `archive_clinical_history`, que desa tot o res a `clinical_archive_patients`
  (nom, naixement, correu, telèfon, última atenció) i
  `clinical_archive_entries` (primera visita, seguiments, notes de sessió,
  documents i TOTS els consentiments de salut, amb la retirada; autors com a
  text). Si qualsevol pas falla, es treuen les còpies i la baixa s'atura sense
  haver esborrat res. Termini: 15 anys des de l'última sessió de fisio passada
  (o l'última entrada clínica), per entrada (`purge_after`), per poder passar
  algun tipus a 5 anys. La confirmació de la baixa ho diu («L'historial clínic
  es conservarà fins al dd/mm/aaaa (Llei 21/2000)») i dona el text per a la
  persona en ca/es/en (`clinicalErasure.text`); la política de privacitat en
  porta la versió general (`p2c`). Lectura: RLS, l'admin tot i els fisios demo
  amb demo (`is_demo`, que surt de `demo_profiles`); ningú no hi escriu per
  l'API. Pantalles: `/admin/arxiu-clinic` (pestanya de Persones, amb
  exportació JSON) i `/trainer/arxiu-clinic` (només fisios); cada obertura i
  exportació va a `data_access_log` (`clinical_archive_view`,
  `clinical_archive_export`); els documents, amb URL signada de 10 minuts
  després de llegir la fila amb la sessió. Purga: dins del cron diari
  (`/api/cron/reminders`, el pla gratuït només en permet un):
  `purgeExpiredClinicalArchive` esborra primer els fitxers per l'API de
  Storage i després `purge_clinical_archive`, que anota `clinical_purge` sense
  el nom. Proves: `supabase/tests/0119_clinical_archive_rls.sql` (35 ✓) i
  `npm run archive:check`.
- **Un client no pot ser a dos llocs alhora** (`0105`): la constraint
  `reservations_no_client_overlap` (exclusió per `client_id` i franja `[)`,
  només reserves `booked`) ho garanteix a tots els camins, i les funcions de
  reservar i de moure (`book_group_slot`, `book_individual_slot`,
  `reschedule_reservation`) ho miren abans de tocar cap bo i tornen
  `client_overlap`. L'app ho comprova per solapament a tots els camins
  (`findClientOverlap`, `lib/data/reservations.ts`) i tradueix els motius a
  `lib/booking-conflict.ts`; l'error 23P01 es distingeix del de la 0082 pel
  nom de la constraint.
- **La baixa RGPD acaba sempre** (`lib/data/gdpr-delete.ts`): arxiu clínic
  primer (0119), després documents, proves i pagaments anonimitzats, el compte
  d'Auth (cascada) i, al final, la foto de perfil (`profile-avatars/{perfil}/`,
  `deleteAllAvatarsOf`). Els referits (`0122`) ja no la frenen: la recompensa de
  qui plega cau amb ell (`beneficiary` en cascada), la d'un altre on surt de
  padrí o de referit es queda amb el camp a NULL, i qui va venir amb el seu codi
  es queda sense padrí (`referred_by_client_id` a NULL). Els vals de regal
  (`0123`): el que va comprar sobreviu (`buyer_client_id` a NULL), bescanviable i
  amb el seu PDF (si cal regenerar-lo, a `sense-comprador/`); el que va
  bescanviar es queda «bescanviat» sense ell (el check ja no exigeix
  `redeemed_by_client_id`). L'admin descarrega els PDF per
  `/admin/vals-regal/[id]/pdf` (`lib/gift-voucher-pdf-response.ts`). Proves:
  `supabase/tests/0122_referrals_on_client_delete.sql`,
  `supabase/tests/0123_gift_vouchers_buyer_delete.sql` i `npm run archive:check`.
- **Comptes demo separats dels reals; una sola font, `demo_profiles`** (`0110`,
  `0121`): quins comptes són demo ho diu la taula, a la base (`same_world`,
  `is_demo_profile`) i a l'app. L'app la llegeix amb `getDemoWorld()`
  (`lib/data/demo-world.ts`, la funció `demo_world()` amb la clau de servei, una
  lectura per petició amb `React.cache`) i les regles de `lib/demo-accounts.ts`
  són pures i reben aquest «món» com a paràmetre **obligatori**
  (`clientBookingScope`, `canReadClinical`, `demoAssignmentAllowed`…): el
  compilador assenyala qualsevol camí que se n'oblidi. El navegador no rep mai
  la llista: el calendari del client i el selector de professional arriben ja
  filtrats del servidor. **Si la lectura falla, tothom és real** (món buit), mai
  demo. Escriure a `demo_profiles` només es pot per SQL (la 0121 treu el permís
  a `service_role`) i cada alta, canvi o baixa queda a `data_access_log`
  (`demo_profile_added` / `demo_profile_removed`). La regla cobreix reservar, la
  cua, les sèries, la promoció, assignar professional, l'historial clínic, /prova
  i l'Inici. El **mode PRE** és a part: la seva llista blanca és codi
  (`lib/pre-accounts.ts`) i el salt exigeix, a més, que el compte sigui a
  `demo_profiles` (`demoTargetAllowed`); marcar un compte real com a demo no el
  fa saltable. Proves: `supabase/tests/0121_demo_profiles_rls.sql` (24 ✓) i
  `npm run demo:check`. El pla és treure'ls a un entorn PRE separat.

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
- **La base torna a comprovar el bo en reservar** (`0103`).
  `book_group_slot` i `book_individual_slot` bloquegen la fila del bo
  (`for update`) i hi apliquen la MATEIXA regla que l'app (`assertBonoUsable`,
  `isBonoExpired`, els filtres de reservar, la llista d'espera i les sèries):
  del client, del servei, `active` o `pending_payment`, no caducat i amb les
  sessions esperades. La caducitat es compara amb `p_today`, el dia del centre
  que passa l'app (com a la `0073`), no amb `current_date` en UTC. Els motius
  (`bono_not_found`, `bono_other_client`, `bono_other_service`,
  `bono_not_usable`, `bono_expired`) es tradueixen a `lib/bono-rejection.ts`.
  `p_today` és obligatori des de la `0104` (a la `0103` va tenir valor per
  defecte NULL només per a la transició), i amb bo un null atura la reserva. No depèn del barrido de bons caducats
  (`sweepExpiredBonos`), que només canvia com es veuen.
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
  finestra…) o `pendent` (creix amb el centre). Avui: 114 entrades, 101 acotades
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
- **Només els missatges que calen al navegador** (`lib/i18n/client-namespaces.ts`):
  cada `NextIntlClientProvider` (client, login i registre, aterratges de compte,
  /prova) envia només els namespaces que fan servir els seus components de
  client, no el diccionari sencer (~65 kB per pàgina: correus, PDF del val,
  legals). L'HTML baixa entre un 13 % i un 85 % segons la pàgina. `i18n:client`
  (al `prebuild`) recorre els imports des de totes les entrades de cada àrea i
  falla si en falta cap.
- **El correu de la comunitat** (`lib/notifications/community.ts`): cada
  destinatari queda `queued` al `notification_log` en publicar, i l'enviament va
  a `after()` en lots de 100 (`/emails/batch`), amb clau d'idempotència per lot.
  Un 429 de velocitat es reintenta; la quota diària esgotada deixa la resta com a
  `failed` amb el motiu. L'admin veu «Correu: enviat a N de M».
- **El contacte del centre és una dada, no codi** (`0100`, Configuració →
  Centre): manual, pantalles, peu dels correus, pàgines legals i val de regal en
  surten. El remitent dels avisos no es llegeix: el `Reply-To` és el correu de
  contacte i **només si n'hi ha**; sense, cap correu convida a respondre.
- **Textos legals definitius** (versió 2026-10): avís legal, privacitat i
  cookies a `messages/*.json` (`legalPages.*`), el català mana i sense cap
  claudàtor. Les dades variables surten de Configuració → Centre: titular, NIF,
  adreça i correu (`0100`) i, per a l'apartat de fisioteràpia de l'avís legal,
  el registre sanitari i els fisioterapeutes col·legiats (`0120`,
  `health_registry_number` i `physio_collegiates`); sense dades, la frase no es
  pinta. El banner «Document provisional» va per document (`LEGAL_DRAFT` a
  `components/legal-draft-banner.tsx`): privacitat i cookies ja a `false`;
  l'avís legal, fins que en Marc confirmi aquests dos camps. La taula de cookies
  és l'inventari del codi: si se n'afegeix una, s'ha d'afegir allà.
  `CURRENT_CONSENT_VERSION` (la versió que es desa en acceptar la privacitat)
  és 2026-10.
- **Canvi de correu propi** (`0077`–`0078`, `lib/data/email-change.ts`):
  `supabase.auth.updateUser({ email })` envia al correu VELL un enllaç viu que
  completa el canvi amb un sol clic (comprovat contra el projecte real). Aquí
  l'enllaç va només al correu nou, el vell rep un avís sense acció, i el token de
  GoTrue s'encunya i es gasta al servidor perquè `verifyOtp` no accepta els de
  canvi de correu. L'admin el pot iniciar per a un professional
  (`requestEmailChangeByAdmin`), amb la mateixa confirmació a la bústia nova.

  L'ajust «Secure email change» del panell de Supabase no ho resol: es va
  **verificar a mà dues vegades al setembre de 2026**, amb adreces inequívoques
  identificades per la capçalera `To:` (no per l'assumpte), que amb l'ajust
  activat un sol clic des de qualsevol de les dues bústies completava el canvi,
  sense la doble confirmació que promet. És una verificació manual, no res que es
  pugui comprovar des del codi; el comentari de `lib/data/email-change.ts` la
  recull perquè no es perdi.
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

## Pendent de decidir

- **Dades de salut dels clients que no són teus.** Des de la 0107 un
  professional pot reservar i fer sessions a clients que no té assignats (un
  grup, o la seva especialitat a la seva agenda), però la RLS de les dades de
  salut segueix sent per client ASSIGNAT: documents (`client_documents`, 0025),
  consentiments (`consents`, 0014), exercicis assignats (`client_exercises`,
  0012) i el seu progrés (`exercise_progress`, 0029). (Les antigues
  `measurements` i `client_videos` ja no existeixen a producció: la 0029 va
  esborrar les mesures, comprovat el 12/10/2026.) El cas
  concret: **un fisio que atén un pacient que no té assignat no veu els seus
  documents**. Es queda com és (decisió d'en Marc, 12/10/2026) fins que en
  Marc ho parli amb en Raul i l'assessor. (Si hi ha consentiment de salut i
  quan, sí que ho veu des de la 0110, per `health_consent_status`; la taula
  `consents` no.)
- ~~**El client pot llegir les seves pròpies notes clíniques per l'API.**~~
  **Resolt (0110 + 0111, 13/10/2026).** Les notes clíniques viuen a l'historial
  clínic, sense accés per al client, i la columna `clients.clinical_notes` ja
  no existeix: `GET /rest/v1/clients?select=clinical_notes` torna `42703`.

## Estructura del repositori

```
app/(admin)|(trainer)|(client)/   rutes per rol, protegides per middleware.ts
app/prova, app/legal, app/(auth)  pàgines públiques (traduïdes)
lib/data/                          capa de dades (sessió o clau de servei, sempre darrere de requireRole)
lib/*.ts                           regles pures compartides per pantalla i servidor
lib/help/                          els 3 manuals d'usuari, com a dades i no com a JSX
lib/notifications/                 avisos: plantilles, log, correu, comunitat
lib/mock/                          el mode simulació
supabase/migrations/               109 fitxers SQL numerats, aplicats a mà
messages/{ca,es,en}.json           i18n del client i les pàgines públiques
scripts/                           comprovacions (*:check) i eines de suport
docs/                              aquest document, EMAILS.md i la guia de proves
```
