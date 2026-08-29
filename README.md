# VindiBCN

Aplicación web de gestión para un centro de entrenamiento personal y
fisioterapia: clientes, bonos, reservas y pagos. Sustituye a Trainingym.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase
(base de datos + Auth) · Vercel (hosting) · Stripe (cobro con tarjeta).

> Estado: **MVP funcional**. Autenticación por roles, gestión de clientes,
> bonos, reservas (con repetición semanal), catálogo de servicios, biblioteca
> de ejercicios y progreso, registro de cobros y tablón de comunidad — todo
> con lógica de negocio real sobre Supabase. El cobro con tarjeta va por Stripe
> Checkout. Pendiente principal: pulido del diseño de marca.

## Módulos

| Módulo                     | Estado                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Auth y roles               | ✅ Completo (admin / trainer / client, rutas protegidas)       |
| Clientes                   | ✅ Completo (CRUD, asignación de entrenador/a, ficha)          |
| Bonos                      | ✅ Completo (alta con precio y servicio asociado)              |
| Reservas                   | ✅ Completo (agenda, crear/cancelar, repetición semanal)       |
| Catálogo de servicios      | ✅ Completo (CRUD de servicios y precios)                      |
| Ejercicios y progreso      | ✅ Completo (biblioteca + mediciones por cliente)              |
| Comunidad (anuncios)       | ✅ Completo (tablón con CRUD, feed para entrenadores/as)       |
| Pagos                      | ✅ Registro de cobros (al vender un bono y alta manual, efectivo/tarjeta) |
| Stripe (cobro online)      | ✅ Checkout alojado en compra de bono y vales de regalo        |

## Modo simulación (mock) vs. real

[`lib/config.ts`](lib/config.ts) expone `USE_MOCK`, que decide si la app usa
un almacén en memoria de datos de prueba o Supabase de verdad:

- Está en **mock** mientras `NEXT_PUBLIC_SUPABASE_URL` falte o sea el
  placeholder de previsualización (útil para desarrollar sin backend).
- Pasa a **real** automáticamente en cuanto pongas una URL de Supabase válida
  en `.env.local`. No hay que tocar código.
- Puedes forzar el mock con `NEXT_PUBLIC_USE_MOCK=true`.

---

## Requisitos

- Node.js 18.18+ (recomendado 20+)
- Una cuenta de [Supabase](https://supabase.com) con un proyecto creado
- (Opcional, para migraciones por CLI) [Supabase CLI](https://supabase.com/docs/guides/cli)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Variables de entorno

Copia el ejemplo y rellena los valores reales de tu proyecto Supabase
(Project Settings → API):

```bash
cp .env.local.example .env.local
```

| Variable                        | Dónde encontrarla                     | Uso                                   |
| ------------------------------- | ------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | API → Project URL                     | Cliente y servidor                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API → anon public                     | Cliente (protegida por RLS)           |
| `SUPABASE_SERVICE_ROLE_KEY`     | API → service_role (**secreta**)      | Solo servidor; salta la RLS           |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse en el navegador ni
> llevar el prefijo `NEXT_PUBLIC_`. `.env.local` está en `.gitignore`.

## 3. Aplicar la migración de base de datos

El esquema vive en [`supabase/migrations/`](supabase/migrations/) y se aplica
en orden:

| Migración                       | Contenido                                              |
| ------------------------------- | ------------------------------------------------------ |
| `0001_initial_schema.sql`       | `profiles`, `clients`, `bonos`, `reservations`, `payments`, enums, RLS y el trigger que crea un perfil al registrarse |
| `0002_services.sql`             | Catálogo de servicios y precios                        |
| `0003_exercises_progress.sql`   | Biblioteca de ejercicios y mediciones de progreso      |
| `0004_community.sql`            | Tablón de anuncios de la comunidad                     |

Incluyen sus enums y las políticas de **Row Level Security** correspondientes.

**Opción A — SQL Editor (rápida, sin instalar nada):**
abre el SQL Editor de tu proyecto en supabase.com, pega el contenido del
archivo y ejecútalo.

**Opción B — Supabase CLI (recomendada para el equipo):**

```bash
supabase link --project-ref <tu-project-ref>
supabase db push
```

Para desarrollo 100% local con Docker:

```bash
supabase start      # levanta Postgres + Studio en local
supabase db reset   # aplica todas las migraciones de /supabase/migrations
```

## 4. (Opcional) Regenerar los tipos de la base de datos

`types/database.ts` está escrito a mano de momento. Cuando tengas el proyecto
en marcha, puedes regenerarlo automáticamente:

```bash
# desde un proyecto remoto
npx supabase gen types typescript --project-id <tu-project-ref> > types/database.ts

# o desde el Supabase local
npx supabase gen types typescript --local > types/database.ts
```

## 5. Arrancar en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Pago con tarjeta (Stripe Checkout)

Hay dos formas de pagar un bono o un vale de regalo: **pagar al centro** (crea
el registro en `pending_payment` y lo activa el admin al cobrar) o **pagar con
tarjeta**, que usa [Stripe Checkout](https://stripe.com/docs/payments/checkout)
alojado — la página de pago es de Stripe, así que los datos de la tarjeta no
pasan nunca por este dominio.

**La regla que ordena todo el flujo:** pulsar "Pagar amb targeta" **no crea
nada**. El bono o el vale nacen cuando Stripe confirma el cobro mediante el
webhook `checkout.session.completed`. La redirección de vuelta no vale como
prueba de pago (se puede cerrar la pestaña, o escribir la URL de éxito a mano),
así que la pantalla de confirmación sólo *consulta* si el webhook ya ha pasado y
espera si todavía no.

| Pieza                                   | Papel                                              |
| --------------------------------------- | -------------------------------------------------- |
| `lib/stripe.ts`                         | Cliente de Stripe, interruptor y origen público     |
| `lib/data/stripe-checkout.ts`           | Abre la sesión y cumple el pago (única fuente)      |
| `app/api/webhooks/stripe/route.ts`      | Verifica la firma y despacha el evento              |
| `/client/bonos/confirmacio`             | Vuelta del pago de un bono                          |
| `/client/regals/confirmacio`            | Vuelta del pago de un vale                          |

Un evento de Stripe puede llegar **más de una vez**. La protección no es una
comprobación en el código sino un índice **único** sobre
`stripe_checkout_session_id` en `bonos` y en `gift_vouchers` (migración `0054`):
el segundo intento rebota con un `23505` que el webhook lee como "ya estaba
hecho" y responde 200. Mismo criterio que el aforo de grupos: la garantía la da
la base, no la suerte.

El webhook queda **fuera del `matcher` del middleware** a propósito, como
`/api/cron/*`: lo autentica la firma de Stripe, no una sesión, y no llama a
`getViewer()`.

Si faltan las claves de Stripe, el botón de tarjeta simplemente no aparece y
sólo se ofrece "Pagar al centre". En modo simulación tampoco se ofrece.

### Probarlo en local

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

El `whsec_...` que imprime ese comando es el `STRIPE_WEBHOOK_SECRET` **de
local**, distinto del que da el Dashboard al registrar el endpoint de
producción. Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y
cualquier CVC.

## Roles y rutas protegidas

La autenticación usa Supabase Auth con tres roles: `admin`, `trainer`,
`client`. El [`middleware.ts`](middleware.ts) protege cada área y redirige
según el rol:

| Ruta        | Rol requerido | Si no cumple                          |
| ----------- | ------------- | ------------------------------------- |
| `/admin/*`  | `admin`       | → su propia área, o `/login` sin sesión |
| `/trainer/*`| `trainer`     | → su propia área, o `/login` sin sesión |
| `/client/*` | `client`      | → su propia área, o `/login` sin sesión |

Al registrarse, el trigger crea el perfil con rol **`client`** por defecto.
Para crear un **admin** o **trainer**, cambia el campo `role` en la tabla
`profiles` desde Supabase Studio (o pásalo en `raw_user_meta_data.role` al
hacer el alta).

## Estructura del proyecto

```
app/
  (auth)/login, (auth)/register   # autenticación
  (admin)/admin                   # área admin: clientes, bonos, reservas,
                                  #   serveis, exercicis, community, pagos
  (trainer)/trainer               # área trainer → /trainer
  (client)/client                 # área cliente → /client
components/                       # componentes compartidos (forms, tablas, UI)
lib/
  config.ts                       # USE_MOCK (mock vs. Supabase real)
  auth.ts                         # getViewer() y helpers de sesión
  data/                           # capa de datos por módulo (clients, bonos,
                                  #   reservations, services, exercises,
                                  #   measurements, announcements, payments…)
  mock/                           # almacén y seed para el modo simulación
  supabase/client.ts              # cliente para el navegador
  supabase/server.ts              # cliente para Server Components / Actions
  supabase/middleware.ts          # refresco de sesión en el middleware
types/database.ts                 # tipos de la BD
supabase/migrations/              # migraciones SQL
middleware.ts                     # control de acceso por rol
```

## Scripts

| Comando         | Acción                          |
| --------------- | ------------------------------- |
| `npm run dev`   | Servidor de desarrollo          |
| `npm run build` | Build de producción             |
| `npm start`     | Sirve el build de producción    |
| `npm run lint`  | ESLint                          |
