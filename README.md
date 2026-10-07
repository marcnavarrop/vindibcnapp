# VindiBCN

L'app de gestió d'un centre d'entrenament personal i fisioteràpia de Barcelona:
clients, bons i subscripcions, reserves i sèries, llista d'espera, sessions de
prova, cobraments, liquidacions i comunitat, amb tres àrees (administració,
professional i client). Substitueix Trainingym.

En producció: **<https://vindibcnapp.vercel.app>**

## Stack

- **Next.js 15** (App Router, TypeScript, Server Actions) i Tailwind CSS.
- **Supabase**: Postgres amb RLS, Auth i Storage (regió eu-west-1).
- **Vercel**: allotjament, funcions a Dublín (`dub1`) i el cron diari
  (`vercel.json`: `/api/cron/reminders`, cada dia a les 18:00 UTC).
- **Resend**: tots els correus (avisos, comptes, comunitat).
- **Stripe**: pagament amb targeta per Checkout allotjat (bons, vals de regal,
  subscripcions).
- **next-intl**: l'àrea del client i les pàgines públiques en català, castellà i
  anglès (`messages/`). L'administració i el professional, en català fix.

## Posar-ho en marxa en local

### Requisits

- Node.js 20 o superior i `npm`.
- Per treballar contra dades reals: un projecte de Supabase. Sense, l'app arrenca
  en mode simulació (vegeu més avall).
- Opcional: la [CLI de Stripe](https://stripe.com/docs/stripe-cli) per provar el
  webhook en local.

```bash
npm install
cp .env.local.example .env.local   # i omple-hi els valors
npm run dev                        # http://localhost:3000
```

### Variables d'entorn

`.env.local` és al `.gitignore` i no s'ha de pujar mai. `.env.local.example`
explica cada variable amb més detall.

| Variable | Per a què serveix |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del projecte de Supabase. Buida o de mostra → mode simulació. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clau pública; la protegeix la RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta, només servidor.** Salta la RLS. Mai amb `NEXT_PUBLIC_`. |
| `RESEND_API_KEY` | Clau de Resend. Sense, no s'envia cap correu. |
| `NOTIFICATIONS_FROM_EMAIL` | Remitent dels avisos automàtics («VindiBCN <hola@…>»). **Aquesta bústia no es llegeix**: per rebre respostes hi ha el correu de contacte de Configuració. |
| `ALLOW_REAL_EMAILS` | `true` per enviar correus de debò fora de la producció de Vercel. Per defecte, fora de producció no surt res i queda al `notification_log` com a `failed`. |
| `NEXT_PUBLIC_APP_URL` | Domini de l'app per als enllaços i el logo dels correus. A Vercel es dedueix sol; en local, cal. |
| `NEXT_PUBLIC_SITE_URL` | Opcional. Origen per a les URL de tornada de Stripe, si no coincideix amb el host. |
| `STRIPE_SECRET_KEY` | **Secreta.** Sense, el botó «Pagar amb targeta» no surt i només hi ha «Pagar al centre». |
| `STRIPE_WEBHOOK_SECRET` | Secret de signatura de `/api/webhooks/stripe`. El de local (`stripe listen`) no és el de producció. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Declarada per coincidir amb Vercel; avui el codi no la fa servir. |
| `CRON_SECRET` | Autentica les crides a `/api/cron/*`. |
| `CENTER_EMAIL` | **Només l'últim recurs** dels avisos interns (proves, altes). Primer van al «Correu per als avisos interns» i, si és buit, al correu de contacte, tots dos de Configuració → Centre. |
| `CENTER_TIMEZONE` | Opcional. Zona horària del centre (per defecte, `Europe/Madrid`). |
| `SUPABASE_MAX_ROWS` / `SUPABASE_ROWS_WARN` | Opcionals. El sostre de files del projecte (1000) i a partir de quantes es deixa un avís als registres (500). |
| `EMAIL_LOGO_URL` | Opcional. URL fixa del logo dels correus. |
| `NEXT_PUBLIC_USE_MOCK` | `true` força el mode simulació. |
| `MOCK_FAIL` | Opcional, només simulació: fa fallar a posta parts de la càrrega per provar els missatges d'error. |

`VERCEL_ENV` i `VERCEL_PROJECT_PRODUCTION_URL` les posa Vercel; no s'han
d'escriure. El contacte del centre (telèfon, correu que es llegeix, adreça,
dades legals) **no** és una variable: és a Configuració → Centre (`center_settings`).

### El mode simulació (mock)

`USE_MOCK` (`lib/config.ts`) decideix si l'app fa servir Supabase o un magatzem
de proves:

- S'activa sol si `NEXT_PUBLIC_SUPABASE_URL` falta o és de mostra, i es força
  amb `NEXT_PUBLIC_USE_MOCK=true`.
- Les dades surten de `lib/mock/seed.ts` i es desen a
  `<tmpdir>/vindibcn-mock.json`: el que es prova hi queda. Per tornar a començar,
  esborra aquest fitxer.
- El rol es tria amb la galeta `vindi_mock_role` (`admin`, `trainer`, `client`) i
  l'idioma, amb `vindi_locale`.
- En simulació no s'envia cap correu ni hi ha pagament amb targeta.
- Els `npm run *:check` treballen sobre aquest mateix magatzem i el deixen tal
  com era.

## Estructura

```
app/
  (admin)/admin/        àrea de l'administració
  (trainer)/trainer/    àrea del professional
  (client)/client/      àrea del client (traduïda)
  (auth)/, auth/        accés, registre, contrasenya, confirmació de correu
  prova/                sessió de prova pública (sense compte)
  legal/                avís legal, privacitat i galetes
  api/                  webhook de Stripe i cron
  actions/              accions de servidor compartides entre àrees
components/             components; components/ui/ són les peces bàsiques
lib/
  data/                 capa de dades per mòdul (una funció per lectura o
                        escriptura; aquí hi ha el «què es pot fer» de debò)
  help/                 els tres manuals dins de l'app (client, professional,
                        admin), construïts amb els ajustos reals del centre
  notifications/        avisos: plantilles, log, canal de correu, comunitat
  mock/                 magatzem i dades de la simulació
  supabase/             clients de Supabase, lectura per pàgines i avís del sostre
  i18n/                 configuració dels idiomes
  *.ts                  regles pures compartides (franges, ocupació, abast de
                        reserva, comptes demo, contacte del centre…)
messages/               diccionaris ca/es/en (next-intl)
i18n/                   càrrega del diccionari per petició
types/database.ts       tipus de la base (escrits a mà)
supabase/migrations/    migracions SQL, numerades
scripts/                comprovacions (`*:check`) i eines de suport
docs/                   documentació de treball (correus, guia de proves)
middleware.ts           accés per rol a /admin, /trainer i /client
```

### Rols i rutes

`middleware.ts` protegeix cada àrea: `/admin/*` només admin, `/trainer/*`
només professional, `/client/*` només client; qualsevol altre rol va a la seva
àrea, i sense sessió, a `/login`. El registre crea perfils de **client**; els
professionals els crea l'admin des de Persones → Professionals.

El middleware **no** protegeix les accions de servidor: vegeu les normes de la
casa.

## Migracions

- Viuen a `supabase/migrations/`, numerades amb quatre xifres i un nom
  descriptiu (`0100_center_contact.sql`). La següent és la següent xifra; no es
  reaprofiten números.
- **Les aplica sempre en Marc, a mà**, abans del push del codi que les fa
  servir. El codi no s'apuja fins que la migració és a producció. Cada migració
  ha de ser **idempotent** (`if not exists`, `drop … if exists`, `create or
  replace`) i s'assaja abans (PGlite) amb els casos bons i dolents.
- Patró de seguretat de les funcions:
  - `security definer` només quan cal saltar la RLS, sempre amb
    `set search_path = public`.
  - `revoke execute … from public, anon` **abans** del `grant execute … to
    authenticated`: Postgres dona l'execució a tothom per defecte.
  - Les comprovacions d'admin, amb `coalesce(public.is_admin(), false)`:
    `is_admin()` torna `NULL` sense perfil (la clau de servei, una sessió
    estranya), i `if not NULL` no entra.
- La RLS es prova al SQL Editor fent-se passar per un usuari (`set_config` de
  `request.jwt.claims` + `set local role authenticated`), dins d'una transacció
  que acaba en `rollback`.

## Comprovacions

En simulació i sense tocar cap base ni enviar res. Les dues primeres corren
soles a cada build (`prebuild`):

| Ordre | Què protegeix |
| --- | --- |
| `npm run rows:check` | **(prebuild)** Cap lectura nova sense límit: tot `.select` sense `.limit`/`.range`/`.single`/`head` ha de ser a `scripts/row-limit-allowlist.json`. |
| `npm run actions:check` | **(prebuild)** Cap acció de servidor sense mirar qui la crida (`requireRole`/`getViewer`), llevat de les públiques de `scripts/public-actions.json`. |
| `npm run roles:check` | Qui pot fer servir de debò les accions que escriuen amb la clau de servei. |
| `npm run i18n:check` | Cada clau `t("…")` existeix i ca/es/en tenen el mateix arbre. |
| `npm run manual:check` | El manual del client té la mateixa estructura als tres idiomes, sense textos provisionals, amb contacte i sense. |
| `npm run scope:check` | Amb qui pot reservar un client, a tots els camins del servidor. |
| `npm run demo:check` | Comptes demo i reals separats (calendari, cua, sèries, l'equip, /prova). |
| `npm run slots:check` | El pas d'hores a mitges hores no ha mogut cap resposta. |
| `npm run dayslots:check` | La llista d'hores del client diu el mateix que el servidor, a qualsevol zona. |
| `npm run free:check` | Els forats «lliures» de les pantalles són els que el servidor acceptaria. |
| `npm run grid:check` | La geometria de la rejilla del professional. |
| `npm run availability:check` | La validació de servidor de les franges de disponibilitat. |
| `npm run occupancy:check` | L'ocupació del calendari del client, /prova i les sèries, sencera i amb final. |
| `npm run blocks:check` | Els bloquejos es llegeixen per finestra, no tot l'històric. |
| `npm run series:check` | Les sèries i les alternatives entenen la mitja hora. |
| `npm run series:bonos` | L'assistent de sèries compta tots els bons del client. |
| `npm run waitlist:check` | La llista d'espera: mai promociona a una sessió passada, les esperes de sèrie són de la sèrie, i la sessió que entra no compta dos cops. |
| `npm run search:check` | El buscador de clients (accents, majúscules). |
| `npm run clients:check` | La llista de clients per pàgines, amb cerca i filtres al servidor. |
| `npm run payments:check` | Els pagaments per pàgines i els totals. |
| `npm run bonos:check` | Els bons per pàgines, els comptadors i el «Pendent de cobrament». |
| `npm run paid:check` | Cobrar un bo: o s'activa exactament un bo i s'anota el pagament, o error i res anotat. |
| `npm run notes:check` | La nota ràpida de la fitxa: una línia a sota de les generals, les clíniques intactes, i mai trepitja una edició feta alhora. |
| `npm run community:check` | El correu de la comunitat arriba a tothom, en lots, i cap fallada queda en silenci. |
| `npm run contact:check` | El contacte del centre: format, peu i Reply-To dels correus, pàgines legals, avisos interns. |
| `npm run emailchange:check` | El canvi de correu d'un professional que inicia l'admin. |
| `npm run emailtaken:check` | Donar d'alta un client o un professional amb un correu que ja té compte: s'atura abans de crear res, en català. |

**Si falla el `prebuild`**, el build s'atura i Vercel no publica res:

- `rows:check`: la lectura nova s'acota (`.limit`, `.range`, un filtre per id o
  per finestra, o `fetchAllRows` de `lib/supabase/fetch-all.ts`) o s'anota a
  `row-limit-allowlist.json` com a `acotada` o `pendent`, amb el motiu. Si diu
  «JA NO EXISTEIX», cal treure l'entrada.
- `actions:check`: la primera línia de l'acció ha de ser
  `const viewer = await requireRole(...); if (!viewer) return …`. Si és pública a
  propòsit, s'anota a `public-actions.json` amb el motiu.

Altres eines, per comparar abans i després d'un canvi: `npm run
emails:snapshot` (tots els correus a disc, per fer-ne un `diff`), `emails:review`
(una pàgina amb cada correu en els tres idiomes de costat), `legal:snapshot` (el
text visible de les pàgines legals), `voucher:snapshot` (el PDF del val) i
`i18n:inventory` (els textos que arriben a l'àrea del client).

## Normes de la casa

- **`requireRole(...)` a la primera línia de cada acció de servidor** no pública.
  Una acció es pot cridar pel seu id des de qualsevol pàgina: el middleware no la
  protegeix, i les que escriuen amb la clau de servei no tenen cap més barrera.
  `actions:check` ho exigeix i `roles:check` comprova que la condició és la bona.
- **Cap lectura sense límit.** Supabase talla cada resposta a 1000 files sense
  avisar. Les llistes que creixen van per pàgines («Carregar més»); els totals els
  calcula la base (`payments_summary`, `payments_by_month`, `bonos_summary`); les
  lectures que han de ser completes van amb finestra i `fetchAllRows`. La resta,
  anotada a `row-limit-allowlist.json`. `lib/supabase/row-cap.ts` deixa un avís
  als registres a partir de 500 files.
- **Comptes demo només entre ells.** L'Entrenador Demo, el Fisio Demo i el Client
  Demo (`lib/demo-accounts.ts`) no es barregen amb comptes reals: cap client real
  els veu ni hi reserva, /prova no n'ofereix hores i l'equip no els pot creuar.
  «Admin Demo» (`vindibcn@gmail.com`) **no** és un compte demo: és l'admin real
  d'en Raul.
- **Correus.** El remitent no es llegeix; el Reply-To és el correu de contacte
  del centre, i només si n'hi ha. Fora de la producció de Vercel no surt res
  (`ALLOW_REAL_EMAILS`). Tot queda al `notification_log`.
- **Push directe a `main`** quan tot és verd: Vercel desplega sol. **Parada
  abans del push** si el canvi toca diners (cobraments, bons, pagaments),
  permisos o RLS, o comptes, i sempre que hi hagi una migració (primer
  l'aplica en Marc).
- **Cada canvi visible**: Playwright a 375 i 1280 px, textos en ca/es/en on els
  vegi el client, i els manuals (`lib/help`) i la guia de proves al dia.

### Pagament amb targeta (Stripe)

Prémer «Pagar amb targeta» **no crea res**. El bo o el val neixen quan arriba el
webhook `checkout.session.completed` a `app/api/webhooks/stripe/route.ts`, que
verifica la signatura i crida `lib/data/stripe-checkout.ts`. La pantalla de
tornada només consulta si el webhook ja ha passat. Un mateix esdeveniment pot
arribar dues vegades: l'índex únic de `stripe_checkout_session_id` (0054) fa que
el segon reboti (`23505`) i es respongui 200. El webhook, com `/api/cron/*`,
queda fora del middleware: l'autentica la signatura, no una sessió.

En local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` i la
targeta de prova `4242 4242 4242 4242`.

## Documentació relacionada

- **`docs/ARQUITECTURA.md`**: la visió tècnica per a un revisor extern (model de
  seguretat, integritat financera, decisions d'enginyeria amb fitxer i migració).
- **`docs/EMAILS.md`**: tots els correus, qui els rep, si es poden apagar, el
  contacte i el Reply-To, i el correu de la comunitat.
- **`docs/vindiapp-guia-de-proves.html`**: la guia de proves per pantalla, amb el
  que és nou o s'ha corregit marcat.
- **Manuals dins de l'app** (`lib/help/`): el del client a `/client/ajuda` (en
  tres idiomes), el del professional a `/trainer/ajuda` i el de l'administració
  a `/admin/ajuda`. Es construeixen amb els ajustos reals del centre.
