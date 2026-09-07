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

| Evento | Destinatario | Default email |
|---|---|---|
| `reservation_confirmed` / `reservation_cancelled` | cliente | ✅ |
| `session_reminder` | cliente | ❌ (opt-in) |
| `trial_request` | entrenador del hueco + `CENTER_EMAIL` | ❌ (opt-in) |
| `trial_status` | visitante de la prueba | ✅ |
| `bono_low` | cliente (al quedar 1 sesión) | ❌ |
| `community` | clientes/entrenadores que lo activen | ❌ |
| `trainer_booking_received` / `trainer_booking_cancelled` | entrenador (solo si la acción la hace el **cliente**) | ✅ |
| `trainer_daily_agenda` | entrenador (opt-in) | ❌ |
| `new_client_registered` | admins con la pref + `CENTER_EMAIL` | ✅ |

- Preferencias en `notification_preferences` (migraciones **0019**, **0020**,
  **0021**), fila creada por trigger al crear cada `profile`. UI en Configuració
  (client / trainer / admin), agrupadas ("La meva agenda" para el profesional).

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

- `lib/notifications/brand.ts`: hex copiados de `app/globals.css`
  (`--color-brand-*`): purple `#642263`, purple-light `#965495`, orange
  `#ff6d17`, dark `#1b1d1f`, charcoal `#303133`, muted `#777777`, border
  `#eaeaea`, bg `#f7f7f7`. También `appUrl()` / `appLink()` / `emailLogoUrl()`.
- `lib/notifications/templates.ts`: layout basado en **tablas**, estilos inline,
  ancho 600px, responsive, `color-scheme: light only`. Cabecera con logo
  (`public/logo_vindi.png`) + wordmark "VindiBCN" (fallback de texto si el
  cliente bloquea imágenes). Plantillas auth: `renderInviteEmail` /
  `renderRecoveryEmail` (footer `plain`). Contenido de usuario escapado.

---

## 4. Variables de entorno (Vercel)

| Variable | Uso |
|---|---|
| `RESEND_API_KEY` | envío por Resend |
| `NOTIFICATIONS_FROM_EMAIL` | remitente, p. ej. `VindiBCN <hola@vindibcn.com>` (acepta `Nom <email>`) |
| `NEXT_PUBLIC_APP_URL` | base de los enlaces/CTA (`https://vindibcnapp.vercel.app`) |
| `CRON_SECRET` | protege `/api/cron/reminders` |
| `CENTER_EMAIL` *(opcional)* | correo del centro para avisos de `trial_request` |
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
  por eso hay wordmark de texto al lado.
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
