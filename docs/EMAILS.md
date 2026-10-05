# Correos y autenticación (VindiBCN)

Documentación del sistema de emails (notificaciones + cuentas) y de los flujos
de contraseña. Todos los correos los envía **nuestro código vía Resend**; no
dependemos del envío de emails de Supabase.

## Principio clave

- **Notificaciones de negocio** y **emails de cuenta** (invitación/recuperación)
  se envían con **Resend** desde el servidor.
- De Supabase solo usamos la **Admin API** (`generateLink`, `verifyOtp`) para
  obtener/verificar tokens, **no su envío de emails**.

---

## 1. Sistema de notificaciones (`lib/notifications/`)

- `index.ts` → `notify(event)`: resuelve las preferencias del destinatario y, por
  cada canal habilitado, llama al adaptador y registra el resultado en
  `notification_log` (incluido `skipped_preference`). **Best-effort**: nunca
  rompe el flujo de negocio. `notifyOnce()` añade idempotencia (para el cron).
- Adaptadores: `channels/email.ts` (Resend real) y `channels/whatsapp.ts`
  (STUB, "Pròximament"; listo para conectar Twilio sin tocar nada más).
- `preferences.ts` + `preferences-defaults.ts`: get/update de preferencias.
- `log.ts`: escritura en `notification_log` + `alreadySent()` (idempotencia).
- `templates.ts`: plantillas HTML + texto plano. `brand.ts`: colores/logo/URLs.

### Eventos

«Siempre» = `ALWAYS_SENT_EVENTS` (no se puede apagar). Idioma: «ca/es/en» sale
del `preferred_language` del cliente; «ca» es catalán fijo (admin, profesional,
visitante y desarrollador).

| Evento | Destinatario | Idioma | Default email | Lo dispara |
|---|---|---|---|---|
| `reservation_confirmed` | cliente | ca/es/en | ✅ | cualquier reserva nueva (lleva «Afegir al calendari») |
| `reservation_cancelled` | cliente | ca/es/en | ✅ siempre | cancela el **equipo** o el centro al cerrar disponibilidad (0090) |
| `reservation_cancelled_by_client` | cliente | ca/es/en | ✅ (desactivable, 0102) | cancela el **propio cliente** desde la app: resumen y qué pasa con la sesión. Columna propia y no la vieja `reservation_cancelled_email`, que puede tener `false` de antes |
| `reservation_rescheduled` | cliente | ca/es/en | ✅ siempre | el **equipo** le cambia la hora; el cliente no puede reprogramar |
| `session_reminder` | cliente | ca/es/en | ❌ (opt-in) | cron de la víspera; también el botón manual del profesional |
| `waitlist_fulfilled` | cliente | ca/es/en | ✅ siempre | se libera plaza y se le reserva |
| `trial_request` | profesional del hueco + avisos internos (`internalNotifyEmail`) | ca | ❌ (opt-in) | visitante en `/prova` |
| `trial_status` | visitante de la prueba | ca | ✅ siempre | el equipo la confirma o la rechaza |
| `bono_low` | cliente | ca/es/en | ❌ | al cruzar el umbral configurable; **no** si el bono tiene `auto_renew` |
| `bono_expiring_soon` | cliente | ca/es/en | ✅ | cron |
| `bono_auto_renewed` | cliente | ca/es/en | ✅ siempre | bono agotado con renovación pedida: nace uno pendiente de pago |
| `bono_renewal_failed` | cliente | ca/es/en | ✅ siempre | la renovación pedida no puede hacerse (paquete retirado o solo por suscripción) |
| `bono_unpaid_cancelled` | cliente | ca/es/en | ✅ siempre | cron: bono sin pagar fuera de plazo |
| `subscription_renewed` / `_payment_failed` / `_cancelled` | cliente | ca/es/en | ✅ siempre | webhook de Stripe y cron de renovación. La renovada lleva el importe: «Import cobrat» (lo que Stripe ha cobrado, `charged`) o «Import mensual» si viene del cron (el bono nace pendiente de pago). La baja lleva «Activa fins al»: el día antes de `next_renewal_on` |
| `subscription_paused` / `_resumed` | cliente | ca/es/en | ✅ siempre | congelar / reanudar |
| `gift_voucher_gifted` | quien recibe el regalo (sin cuenta) | ca/es/en (el del **comprador**) | — | compra de un vale con envío por correo |
| `gift_voucher_redeemed` | comprador | ca/es/en | ✅ siempre | alguien canjea el código |
| `community` | clientes/profesionales que lo activen | ca/es/en | ❌ | el admin publica un anuncio (lotes de 100) |
| `new_exercises_assigned` | cliente | ca/es/en | ❌ | el profesional pulsa «Notificar exercicis nous» |
| `trainer_booking_received` / `trainer_booking_cancelled` | profesional (solo si la acción la hace el **cliente**) | ca | ✅ | el cliente reserva / cancela |
| `trainer_daily_agenda` | profesional | ca | ❌ | cron diario |
| `invoice_generated` | profesional | ca | siempre | el admin emite la liquidación en Facturació |
| `new_client_registered` | admins con la pref + avisos internos (`internalNotifyEmail`) | ca | ✅ | registro público |
| `support_ticket_created` | desarrollador (`DEVELOPER_EMAIL`) | ca | siempre | admin o profesional abren un tiquet. Reply-To = quien lo abre |

Correos de cuenta (no pasan por `notify()`, ver §2): `auth_invite`,
`auth_recovery`, `auth_welcome`, `auth_email_change`, `auth_email_change_alert`.
Todos en el idioma del perfil (ca/es/en).

### Cambio de hora (`reservation_rescheduled`)

- **Obligatorio** (`ALWAYS_SENT_EVENTS`), por el mismo criterio que la
  cancelación: la reserva nueva se ve en la app, pero que la hora de antes ya no
  es suya no lo dice en ningún sitio, y quien la tenía apuntada se presentaría.
  Sin columna en `notification_preferences` ni casilla en Configuració.
- Lo envía `rescheduleReservation` (`lib/data/reservations.ts`) **solo si
  `reschedule_reservation` (0093) devuelve `ok:true`**, fuera de la transacción,
  como el de cancelación; si la función rechaza el movimiento, no sale nada.
- Lleva la hora nueva y la antigua, el servicio y el profesional, en el idioma
  del cliente (ca/es/en). Si la sesión es de una serie, añade que solo cambia
  esa sesión.
- Solo lo disparan el admin y el profesional del cliente (`assertMayBookFor`);
  no existe ningún camino para que el cliente reprograme su propia reserva, así
  que nunca se le avisa de un cambio suyo.
- Snapshot: `reservation_rescheduled` y `reservation_rescheduled__serie`.

- Preferencias en `notification_preferences` (migraciones **0019**, **0020**,
  **0021**), fila creada por trigger al crear cada `profile`. UI en Configuració
  (client / trainer / admin), agrupadas ("La meva agenda" para el profesional).

### Novedades de la comunidad (`community`)

- `lib/notifications/community.ts`, en dos pasos desde `createAnnouncementAction`
  (solo admin):
  1. `queueCommunity`: lee los apuntados (`community_email = true`) **por
     páginas** y deja una fila `queued` por persona en `notification_log`. Sin
     tope (antes, 500).
  2. `deliverCommunity`, en `after()`: lotes de 100 con `POST /emails/batch`
     (`sendEmailBatch` en `lib/email.ts`), cada uno con su idioma, y cada fila
     pasa a `sent` (con `provider_id`) o `failed` (con el motivo).
- Límites de Resend: 10 peticiones/s (cabecera `ratelimit-policy: 10;w=1`) y la
  cuota diaria/mensual del plan, **compartida con el resto de avisos**. No se
  puede leer por la API sin enviar. `rate_limit_exceeded` → espera `retry-after`
  y reintenta (hasta 3, con `Idempotency-Key` por lote). `daily_quota_exceeded` /
  `monthly_quota_exceeded` → ese lote y todos los siguientes quedan `failed` con
  «Límit diari/mensual de correus de Resend esgotat», sin más llamadas.
- La lista de Comunitat enseña «Correu: enviat a N de M» (recuentos `head` del
  log) en los anuncios del último mes. `queued` más de 15 min = el proceso se
  paró.
- Duración: Vercel Hobby con Fluid compute, 300 s por función (`maxDuration =
  300` en `admin/community/new`); `after()` cuenta dentro. Un lote tarda ~1 s.
- Prueba: `npm run community:check` (simulación, transporte falso, 1.200
  destinatarios).

### Contacto del centro y Reply-To (0100)

- `center_settings`: `contact_phone`, `contact_whatsapp`, `contact_email`,
  `notify_email`, `address`, `legal_name`, `tax_id`. Se editan en Configuració →
  Centre; `lib/center-contact.ts` valida y pinta.
- **Remitente ≠ contacto.** `NOTIFICATIONS_FROM_EMAIL` (hola@…) solo envía; nadie
  lo lee. `contact_email` es el buzón que el centro lee.
- **Reply-To = `contact_email`**, solo en correos a clientes y visitantes
  (pie `client`, `visitor`, `plain`) y solo si está relleno
  (`RenderedEmail.replyTo`). Sin él, ningún texto invita a responder
  (`welcome.outro` → `outroNoReply`; la prueba confirmada, sin la frase).
- **Pie:** dirección (enlace a mapa) y «tel (WhatsApp) · mailto» en esos mismos
  correos (en el texto plano, con «Contacte:» delante); nunca en los del
  profesional, el admin o el tiquet de soporte.
- **Excepción:** el tiquet de soporte (`support_ticket_created`) lleva Reply-To
  al correo de **quien lo abre** (`data.reporterEmail`), no al del centro.
- **Avisos internos** (`trial_request`, `new_client_registered`):
  `notify_email` → `contact_email` → `CENTER_EMAIL`.
- Prueba: `npm run contact:check`.

### Cron diario

- `app/api/cron/reminders/route.ts` — recordatorios de sesión del día siguiente
  + resumen de agenda para entrenadores que lo activen. Protegido con
  `CRON_SECRET` (cabecera `Authorization: Bearer …`), idempotente vía
  `notification_log` (con `related_id` determinista para la agenda).
- `vercel.json`: cron a las **18:00 UTC (≈ 20:00 ES)**. Plan gratuito = 1 cron/día.

---

## 2. Emails de cuenta y contraseñas (`lib/notifications/auth-emails.ts`)

Invitación y recuperación con `admin.auth.admin.generateLink()`: obtenemos el
**token sin que Supabase envíe correo** y enviamos nosotros el email de marca.

- `createUserWithInvite()` — alta de entrenador/cliente. La **creación del
  usuario es obligatoria**; el **email es best-effort** (si Resend falla, el
  usuario existe y se puede reenviar). Registra en `notification_log`
  (`auth_invite`).
- `resendInvite()` — botón **"Reenviar invitació"** en admin (listas de
  entrenadores y clientes) → `components/resend-invite-button.tsx` +
  `app/(admin)/admin/invite-actions.ts`.
- `sendPasswordRecovery()` — usado por `/forgot-password` (silencioso si el email
  no existe, para no revelar cuentas).

### Flujo de fijar/cambiar contraseña

1. El enlace del email va a **`/auth/update-password?token_hash=…&type=…`**
   (una PÁGINA, no un route handler).
2. La verificación (`verifyOtp`) se hace **con JavaScript en el navegador**. Los
   escáneres de enlaces de los buzones hacen un GET plano (sin JS) y así **no
   consumen el token de un solo uso** antes de que el usuario clique.
3. Si hay token, **se verifica SIEMPRE primero** (sustituye cualquier sesión
   existente, p. ej. la de un admin) → la contraseña se fija al usuario correcto
   → redirige a la home de su rol.
4. `/auth/callback` (route handler) se mantiene por compatibilidad con enlaces
   antiguos, pero los emails nuevos ya no lo usan.

Otros:
- **`/forgot-password`** (público) + enlace "Has oblidat la contrasenya?" en
  `/login`.
- **Cambio voluntario**: sección "Contrasenya" en Configuració → **Compte** (los
  3 roles), con **reautenticación en el servidor** (ver más abajo). Oculta en
  modo demo/mock. → `components/forms/change-password-form.tsx` +
  `app/actions/password-actions.ts`.
- **Redirect tras login**: `lib/auth-redirect.ts` (`safeRedirect`) — vuelve al
  destino original de un CTA tras loguearse; solo rutas internas y respetando el
  rol (anti open-redirect + anti bypass de permisos).

### Cambio del correo de acceso (`lib/data/email-change.ts`)

El cliente lo pide desde **Configuració → Compte** con su contraseña, y lo
confirma **desde el buzón nuevo**. Migración **0078** (`email_change_requests`).

**No se usa el camino nativo de Supabase**, y el motivo no es la marca:

- `updateUser({email})` manda **dos** correos por su cuenta, con la plantilla
  por defecto en inglés, fuera del `notification_log` y sin pasar por el corte
  de `realSendAllowed()`.
- El que va a la dirección **antigua lleva un enlace vivo**: comprobado dos
  veces contra producción (con direcciones `+buzonviejo`/`+buzonnuevo` para
  descartar confusión), **un solo clic desde el correo viejo aplica el cambio
  entero**. El aviso que debería ser la red de seguridad es el botón que remata
  el robo si alguien se ha hecho con la sesión.

Nuestro flujo: **enlace sólo al correo nuevo**, **aviso sin ninguna acción** al
viejo, ambos en el idioma de quien los recibe y ambos en `notification_log`
(`auth_email_change` / `auth_email_change_alert`).

**Anular** («Anul·lar la petició» del cliente y «Anul·lar l'enllaç» del admin)
marca la petición como consumida; `cancelEmailChange` **lanza si la base
falla** y las dos pantallas lo dicen y siguen mostrando el cambio como
pendiente (antes el error se ignoraba y el enlace seguía vivo 24 h). Una
petición nueva tampoco sale si no se han podido anular las anteriores. Probado
en producción (06/10/2026) con la cuenta demo: tras anular, el enlace real de
`/auth/confirm-email` responde «ja no és vàlid».

**Por qué hay una tabla de por medio.** Invitación y recuperación verifican el
token con JS en `/auth/update-password` para que los escáneres de enlaces (GET
sin JS) no lo quemen. Con el cambio de correo eso no se puede repetir:
`verifyOtp` **no acepta** tokens de `email_change`. Seis métodos probados sobre
el mismo token —seguía vivo, porque el sexto funcionó—:

| Intento | Resultado |
|---|---|
| `POST /verify {type:'email_change', token_hash}` | `403 otp_expired` |
| `POST /verify {type:'email_change_new', token_hash}` | `400` tipo inválido |
| `POST /verify {type:'email_change', token, email: nuevo}` | `403 otp_expired` |
| `POST /verify {type:'email_change', token, email: viejo}` | `403 otp_expired` |
| `GET /verify?token_hash=…&type=email_change` | `400` |
| `GET /verify?token=<crudo>&type=email_change` | **`303`, cambio aplicado** |

El único camino que funciona es justo el que un escáner dispara solo. Por eso
el enlace del correo lleva un **secreto nuestro** (`/auth/confirm-email?r=…`),
de la tabla sólo se guarda su SHA-256, y el token de GoTrue se acuña y se gasta
**en el servidor** cuando la página lo pide con JS.

### Reautenticación: siempre en el servidor

Tanto el cambio de correo como el de contraseña piden la contraseña actual y la
comprueban **en el servidor** (`lib/data/reauth.ts`), con un cliente de un solo
uso que no persiste sesión. Hacerlo en el navegador es un resalte, no una
barrera: quien tenga la sesión puede llamar a la server action y saltárselo.

Dos trampas que costaron sendos arreglos, ambas encontradas probando en
producción y ninguna visible para `tsc`, el lint ni el build:

- `signOut()` **sin argumentos vale `scope: "global"`** y revoca TODAS las
  sesiones de la persona: comprobarle la contraseña la echaba de su propio
  navegador. Va con `scope: "local"`.
- `admin.updateUserById({password})` **también revoca los refresh tokens**. La
  contraseña nueva se aplica con el cliente de SERVIDOR (el que lleva las
  cookies de quien lo pide), no con el Admin API: así GoTrue conserva esa sesión
  y cierra sólo las demás.

### Estados de la contraseña (resumen)

- **Alta** → invitación por email (crear contraseña).
- **Olvido** → `/forgot-password` (recuperación por email).
- **Cambio voluntario** → Configuració (con reautenticación).

---

## 3. Plantillas y marca

Revisión de diseño de octubre de 2026: un solo esqueleto y piezas pequeñas.
Cada plantilla es un `Block` (datos) y `layout()` lo pinta; ninguna escribe
HTML propio.

- **`brand.ts`**: hex de `app/globals.css`. `BRAND` (purple `#642263`, dark,
  charcoal, border, bg; `soft` `#5c5c60` para el texto secundario, AA — el
  `muted` `#777777` se queda para los PDF) y `TONES` (success / attention /
  error / neutral, los del paso 7). El naranja solo está en el logo.
  `EMAIL_LOGO_SIZE` 110×44.
- **`layout()`**: tablas y estilos en línea, 600 px. Preheader oculto (por
  defecto, el párrafo tras el saludo; las sesiones lo llevan con día, hora,
  servicio y profesional), `<title>`, contenedor de 600 px y fuente forzada
  para Outlook (`<!--[if mso]>`), y a < 520 px tarjeta y botón a todo el ancho.
  Solo modo claro, como la app.
- **Piezas** (campos del `Block`):
  - `eyebrow` — etiqueta de estado arriba («✓ Reserva confirmada»), con tono.
  - `heading` — Georgia (la serif de todos los equipos; la de la app es Lora).
  - `hero` + `details` — la tarjeta: etiqueta **encima** del valor (legible a
    375 px); `hero` pone día y hora en grande, o un código (`code: true`).
  - `notices` — avisos que se leen **antes** del botón («todavía no está
    pagado»); `outro` admite también avisos después del botón.
  - `cta` — botón «a prueba de balas» (VML en Outlook, 48 px de alto).
  - `links` — enlaces secundarios (Google Calendar en la confirmación).
  - `footer` — `client`, `trainer`, `admin`, `visitor`, `plain` (cuenta) o
    `internal` (soporte). A clientes, visitantes y cuenta: dirección (enlace a
    mapa), contacto y Reply-To al correo de contacto. `replyTo` en el `Block`
    lo sobrescribe (el tiquet pone el de quien lo abre).
- **`sessionParts()`**: lo común a los correos de una sesión (hero, servicio,
  profesional, «Lloc» con la calle y número de `center_settings.address`).
- **Asuntos** sin «· VindiBCN» al final: ya es el nombre del remitente.
- **Texto plano** con el mismo contenido, también la dirección y los enlaces.
- Contenido de usuario escapado; el asunto es texto plano y **no** se escapa.

Revisión visual: `npm run emails:snapshot -- <carpeta> <ca|es|en>` tres veces
y `npm run emails:review` para verlos en columnas. Solo los correos al equipo,
al visitante y al desarrollador deben salir iguales en las tres.

---

## 4. Variables de entorno (Vercel)

| Variable | Uso |
|---|---|
| `RESEND_API_KEY` | envío por Resend |
| `NOTIFICATIONS_FROM_EMAIL` | remitente, p. ej. `VindiBCN <hola@vindibcn.com>` (acepta `Nom <email>`) |
| `NEXT_PUBLIC_APP_URL` | base de los enlaces/CTA (`https://vindibcnapp.vercel.app`) |
| `CRON_SECRET` | protege `/api/cron/reminders` |
| `CENTER_EMAIL` *(opcional)* | ÚLTIMO recurso de los avisos internos, si en Configuració no hay ni `notify_email` ni `contact_email` |
| `EMAIL_LOGO_URL` *(opcional)* | logo del email; por defecto `/logo_vindi.png` del dominio |

---

## 5. Configuración de Supabase (estado)

Con la arquitectura actual, Supabase **no envía emails**:

- **Custom SMTP** → no es necesario (se puede desactivar). Solo importaría si
  se reactivaran emails propios de Supabase.
- **Plantillas de email** (Invite/Reset) → **sin uso**.
- **Site URL / Redirect URLs** → no imprescindibles en el flujo actual
  (verificación por JS, sin `redirectTo`); inofensivas si se dejan.
- **"Confirm email"** (Authentication → Providers → Email) → **desactivado**: el
  registro público de clientes (`/register` con `signUp`) funciona sin
  confirmación. **No cambiar** sin revisar el impacto en el envío.
- **"Secure email change"** (Authentication → **Sign In / Providers** → Email;
  no en Email Templates, donde sólo están las plantillas) → **activado**, y
  **no hace lo que su nombre promete en este proyecto**. Con él activo la
  documentación dice que hacen falta las dos confirmaciones, la del correo
  viejo y la del nuevo; medido aquí, **basta un clic desde cualquiera de los
  dos**. Se sospecha interacción con el autoconfirm del registro, pero eso
  **no está comprobado** y se deja como conjetura. No nos afecta —nuestro flujo
  no usa el camino nativo— pero conviene saberlo antes de proponer
  "simplifiquemos, que Supabase ya lo hace": no lo hace.

---

## 6. Comportamientos conocidos (no son bugs)

- **Modo oscuro de Gmail**: en cuentas externas añadidas por IMAP, Gmail invierte
  los colores (cabecera morada → rosa). Es del cliente de correo; en cuentas
  Google nativas / Apple Mail / Outlook se respeta la marca. No es controlable
  desde el HTML.
- **Imágenes bloqueadas por defecto**: el logo no aparece hasta "Show images";
  por eso su `alt` («VindiBCN») lleva estilo propio: blanco y grande sobre el
  lila.
- **Outlook de escritorio** no se ha podido probar de verdad (no hay Outlook a
  mano). El código sigue las técnicas estándar (VML, contenedor `mso`, fuente
  en cada elemento); si alguien lo usa, conviene mirar un correo real.
- **BIMI** (logo en el avatar del remitente en Gmail): descartado por coste
  (~1.000 €/año de certificado VMC).
- **`user_metadata.email` se queda desfasado a propósito.** El correo de una
  persona vive en cuatro sitios. Tres se mantienen solos: `auth.users.email` y
  `identities[].identity_data.email` los lleva GoTrue, y `profiles.email` lo
  sigue el trigger de la **0077**. El cuarto,
  `auth.users.raw_user_meta_data.email`, **no**: tras un cambio de correo se
  queda con el valor viejo.
  **No lo leas.** De todo el metadata, el código sólo usa `full_name`
  (`lib/notifications/auth-emails.ts`). No lo sincronizamos porque esa columna
  la escribe GoTrue en cada alta —cualquier copia nuestra la puede deshacer él—
  y borrarlo tampoco dura: el registro siguiente lo repone. Un desfase uniforme
  y documentado se razona; uno intermitente, no.

---

## 7. Migraciones relacionadas

- **0019** — `notification_preferences` + `notification_log` + trigger.
- **0020** — columnas de agenda del profesional (`trainer_booking_*`,
  `trainer_daily_agenda`).
- **0021** — columnas del aviso de nuevo cliente (`new_client_registered_*`).
- **0077** — trigger que sincroniza `profiles.email` cuando cambia el de Auth.
- **0093** — `reschedule_reservation`: tras su `ok:true` sale `reservation_rescheduled`.
- **0102** — `reservation_cancelled_by_client_email` (default `true`): la casilla del correo cuando cancela el propio cliente.
- **0078** — `email_change_requests` (RLS cerrada: sin políticas, sólo la clave
  de servicio).

## 8. Registro público de clientes (`/register`)

`signUp` con contraseña propia del usuario — **camino independiente** del alta
por admin (que usa invitación). Al completarse el registro,
`onNewClientRegistered` (`lib/data/registration.ts`), disparado por una server
action que actúa sobre el **usuario autenticado por cookie** (no un id del
navegador):

1. **Crea la fila `clients`** si falta (el trigger solo crea el `profile`), así
   el auto-registrado aparece en el panel de admin.
2. **Email de bienvenida** de marca al cliente (`renderWelcomeEmail`,
   best-effort, log `auth_welcome`), con CTA a `/client`.
3. **Aviso `new_client_registered`** a los admins con la preferencia activada
   (default true) + `CENTER_EMAIL` si existe, con CTA a la ficha
   `/admin/clients/[id]`.

**Idempotente y sin solapamiento con el alta por admin**: si la fila `clients`
ya existe (procesado o creado por un admin), no hace nada → nunca duplica.
