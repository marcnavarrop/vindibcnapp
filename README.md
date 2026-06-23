# VindiBCN

Aplicación web de gestión para un centro de entrenamiento personal y
fisioterapia: clientes, bonos, reservas y pagos. Sustituye a Trainingym.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase
(base de datos + Auth) · Vercel (hosting) · Stripe (pagos, en una fase
posterior).

> Estado: **MVP funcional**. Autenticación por roles, gestión de clientes,
> bonos, reservas (con repetición semanal), catálogo de servicios, biblioteca
> de ejercicios y progreso, y tablón de comunidad — todo con lógica de negocio
> real sobre Supabase. Pendientes principales: registro de cobros / Stripe y
> pulido del diseño de marca.

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
| Pagos                      | ⚠️ Solo lectura — lista cobros, falta registrarlos            |
| Stripe                     | ❌ No empezado (fase posterior)                                |

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
