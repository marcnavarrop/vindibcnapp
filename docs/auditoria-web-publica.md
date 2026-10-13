# Auditoría de la web pública de VindiApp

**Fecha:** 13/10/2026 · **Entorno:** producción (`https://vindibcnapp.vercel.app`, despliegue de `main` en `8e9b3a4`) · **Tipo:** solo diagnóstico, sin cambios de código ni de datos.

Páginas públicas auditadas: `/` (redirige a `/login`), `/login`, `/register`, `/forgot-password`, `/prova`, `/legal/privacitat`, `/legal/avis-legal`, `/legal/cookies`, `/auth/confirm-email`, `/auth/update-password` y la 404.

Capturas de evidencia en [`docs/auditoria-capturas/`](auditoria-capturas/).

---

## Resumen ejecutivo

**Lo que está bien.** Técnicamente, la parte pública es sólida: **ninguna de las 330 combinaciones** (10 páginas × 11 tamaños × 3 motores) tiene scroll horizontal, solapes graves ni textos cortados; el rendimiento es excelente (Lighthouse 93–99 en móvil y 100 en escritorio, LCP ~2,1 s en móvil simulado, CLS ≈ 0); el cambio de idioma funciona y se recuerda; no hay secretos en el HTML ni en el JS; no hay errores de consola ni enlaces rotos; y el zoom al 200 % no rompe nada.

**Lo que más pesa.**

1. **No hay una web pública del centro.** `/` redirige al login del área de cliente. Quien llega desde Google o Instagram ve «Àrea client / Benvingut de nou» y un formulario de contraseña: no sabe qué es Vindi, qué ofrece, dónde está ni cuánto cuesta. Es el problema principal de conversión y de SEO, y es una **decisión de Marc y Raul** (¿hay otra web de marketing a la que enlazar, o esta debe tener portada?).
2. **La sesión de prueba se esconde y luego parece vacía.** En móvil el botón «Sessió de prova gratuïta» queda bajo el pliegue (a 898 px en un iPhone de 844 px de alto). Y `/prova` abre en vista «Día» sobre **hoy, que siempre está vacío** porque la prueba exige 24 h de antelación: el visitante ve 15 horas de rejilla en blanco (captura 01). Arreglo pequeño y de mucho impacto.
3. **SEO casi inexistente:** sin `robots.txt`, sin `sitemap.xml`, sin Open Graph (al compartir por WhatsApp no sale imagen), sin datos estructurados, sin canonical, descripción por defecto interna («Gestió del centre…») y en catalán en varias páginas, y el idioma depende solo de una cookie (Google y un navegador en inglés ven siempre catalán).
4. **Las fuentes de marca no se aplican en ninguna parte.** Lora y Roboto Condensed se descargan y se precargan (84 KB) pero todo se pinta con la fuente del sistema, por cómo están encadenadas las variables CSS. Afecta a **toda la app**, no solo a la parte pública.
5. **Textos legales publicados como borrador**, con marcadores visibles («[A concretar amb l'assessor.]») y sin Stripe en la lista de encargados del tratamiento. Para el asesor.
6. **Accesibilidad mejorable con poco esfuerzo:** el gris de texto secundario (#777) se queda justo por debajo de 4,5:1; el modal de `/prova` no es un diálogo accesible (ni foco, ni Escape); los botones «Lliure» no dicen qué día ni qué hora son; y los campos a 14 px hacen que el iPhone haga zoom al tocarlos.
7. **Sin cabeceras de seguridad** salvo HSTS (sin CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`).

Casi todo lo de los puntos 2, 3 (parte técnica), 4, 6 y 7 son cambios pequeños. Los puntos 1 y 5 necesitan decisiones y contenido que no puedo inventar.

## Puntuación por frente

| Frente | Nota (0–10) | En una frase |
| --- | --- | --- |
| 1. Diseño y maquetación responsive | **7,5** | Sin roturas en ningún ancho ni motor; fallan las fuentes de marca, el horizontal en móvil y detalles de consistencia. |
| 2. Rendimiento | **9** | Muy rápido; solo `/prova` tiene algo de bloqueo en móvil (TBT 310 ms) y no hay caché de ida y vuelta. |
| 3. Accesibilidad (WCAG 2.2 AA) | **6,5** | Buena base (etiquetas, `lang`, zoom), pero contraste justo, modal no accesible y botones sin nombre útil. |
| 4. SEO y compartir | **2,5** | Faltan casi todas las piezas: robots, sitemap, OG, schema, canonical, idioma indexable. |
| 5. Textos y tres idiomas | **7** | Traducciones completas y naturales; un texto fijo en catalán, errores de Auth en inglés y erratas menores. |
| 6. Conversión | **3** | La propuesta del centro no aparece; la prueba existe y funciona, pero cuesta encontrarla y empieza vacía. |
| 7. Legal y privacidad | **4** | Hay páginas y consentimientos, pero son borradores con huecos; sin terceros ni cookies que pidan banner. |
| 8. Técnico y seguridad | **6** | Sin errores, sin secretos y sin enlaces rotos; faltan cabeceras de seguridad. |

## Cómo se ha medido

- **Playwright 1.48** con Chromium, WebKit (motor de Safari/iPhone) y Firefox, en 320×640, 375×812, 390×844, 414×896, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 y en horizontal 812×375 y 667×375 (modo móvil y táctil en Chromium y WebKit). Para cada combinación: scroll horizontal, elementos fuera de la pantalla, textos recortados, zonas táctiles, errores de consola, peticiones fallidas y captura de página entera (330 capturas; en el informe solo van las de los problemas).
- **axe-core 4.10** (WCAG 2.0/2.1/2.2 A y AA + buenas prácticas) en 9 páginas × 3 idiomas × 2 anchos; recorrido con tabulador; árbol de encabezados y landmarks; modo oscuro del sistema; `prefers-reduced-motion`; zoom al 200 %.
- **Lighthouse 12.2** con Chrome, 3 pasadas por página en móvil (simulación 4G lenta) y escritorio, **mediana**.
- `curl` para cabeceras, códigos de respuesta, `robots.txt`, `sitemap.xml`, manifest, enlaces, TTFB y caché; descarga del JS público y búsqueda de claves.
- Lectura del código de las páginas públicas para entender la causa de cada hallazgo.

**Límites (lo que no se ha podido comprobar):**

- **No se ha enviado ningún formulario** (login, registro, prueba, contraseña), por norma: los errores y la confirmación se han revisado en el código y abriendo el modal sin enviarlo. El error de login en inglés (T2) sale del código, no de un intento real.
- No se ha probado con un lector de pantalla real (VoiceOver/NVDA): solo árbol de accesibilidad y axe.
- **INP** no se puede medir en laboratorio; se usa TBT como aproximación. No hay datos de campo (CrUX) porque el dominio no tiene tráfico suficiente.
- La vista previa de WhatsApp se deduce de las etiquetas (no hay Open Graph); no se ha compartido ningún enlace.
- Safari real de iPhone no: WebKit de Playwright en modo móvil, que es el mismo motor.

## Resultados de Lighthouse (mediana de 3)

| Página | Modo | Rend. | Accesib. | Buenas pr. | SEO* | FCP | LCP | TBT | CLS | Peso |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/login` | móvil | 98 | 96 | 100 | 100 | 0,94 s | 2,14 s | 25 ms | 0 | 261 KB |
| `/login` | escritorio | 100 | 96 | 100 | 100 | 0,27 s | 0,59 s | 0 ms | 0 | 411 KB |
| `/prova` | móvil | **93** | 96 | 100 | 100 | 0,93 s | 2,06 s | **310 ms** | 0,033 | 246 KB |
| `/prova` | escritorio | 100 | 96 | 100 | 100 | 0,31 s | 0,47 s | 0 ms | 0 | 246 KB |
| `/register` | móvil | 99 | 96 | 100 | 100 | 0,93 s | 2,13 s | 13 ms | 0 | 263 KB |
| `/register` | escritorio | 100 | 96 | 100 | 100 | 0,27 s | 0,60 s | 0 ms | 0 | 412 KB |
| `/legal/privacitat` | móvil | 99 | 96 | 100 | 100 | 0,93 s | 2,06 s | 24 ms | 0 | 224 KB |
| `/legal/privacitat` | escritorio | 100 | 96 | 100 | 100 | 0,27 s | 0,46 s | 0 ms | 0 | 224 KB |

\* El 100 de SEO de Lighthouse solo mira lo básico (que haya `<title>`, descripción, que sea rastreable). No ve que falten `robots.txt`, sitemap, Open Graph, schema ni hreflang: por eso la nota del frente 4 es baja aunque Lighthouse diga 100.

El escritorio pesa más (411 KB) porque carga la ilustración `hero-entrenament.webp` (149 KB), que en móvil no se descarga a propósito. TTFB medido con `curl` desde Barcelona: 0,18–0,33 s.

---

## Tabla de hallazgos

Impacto: **alto / medio / bajo**. Esfuerzo: **S** (horas), **M** (1–2 días), **L** (más). 🟣 = necesita una decisión de Marc o Raul (contenido, fotos, textos comerciales). ⚖️ = para el asesor legal.

### 6. Conversión

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 🟣 | Conversión | **No hay portada pública.** `/` hace un 307 a `/login`, que es el acceso al área de cliente («ÀREA CLIENT», «Benvingut de nou»). No aparece qué es Vindi BCN, qué servicios ofrece (entrenamiento personal, parejas, grupo reducido, fisioterapia), el equipo, fotos del centro, precios, horario, ubicación ni reseñas. | `/`, todos los anchos y motores | `curl -I /` → `307 location: /login`; `app/page.tsx`; capturas 05 y 10 | alto | L | Decidir primero si existe (o existirá) otra web de marketing. **Si existe**: enlazarla desde el login («Conoce el centro») y que esa web enlace a `/prova`. **Si no**: una portada sencilla en `/` (propuesta del centro en una frase, servicios, 3–4 fotos reales, equipo, dirección con mapa, contacto/WhatsApp, botón de prueba) y el login en `/login`. Todo el contenido lo tiene que dar Raul: no hay textos, fotos, precios ni reseñas en el proyecto. |
| C2 | Conversión | **En móvil, `/prova` abre en vista Día sobre «hoy», y hoy nunca hay huecos** (la prueba pide 24 h de antelación). El visitante ve la rejilla entera vacía y tiene que adivinar que debe pulsar ›. En escritorio (≥768 px) abre en Semana y sí se ven los huecos (captura 03), aunque un viernes o un sábado esa semana también saldrá casi vacía. | `/prova`, 320–767 px (los 3 motores) | medido: 0 franjas hoy; 1 clic en «Següent» → 10 franjas; 45 franjas en la semana. Capturas 01 y 03; `trial-calendar.tsx:106-111` | alto | S | Abrir directamente en el **primer día con franjas libres** (y, en Semana, en la semana de ese día). Si un día no tiene huecos, un aviso en vez de la rejilla vacía: «No hay horas libres este día. Primera disponible: miércoles 14, 15:00 →». |
| C3 | Conversión | **La llamada a la prueba queda bajo el pliegue en móvil.** El panel de marca ocupa ~430 px antes del formulario y el botón de prueba es el tercero, después de «Iniciar sesión» y «Crear cuenta». Para quien no es cliente, la única acción que le sirve es la que menos se ve. | `/login`, 375×812 (920 px), 390×844 WebKit (898 px), horizontal | captura 05; posición medida con Playwright | alto | S | En móvil, poner el botón «Sesión de prueba gratuita» **dentro del panel de marca**, arriba, como acción principal para quien no tiene cuenta, y dejar el bloque de login para clientes. Depende de C1: si hay portada, la prueba va en su primera pantalla. |
| C4 🟣 | Conversión | `/prova` **no explica qué es la sesión** (duración, con quién, qué llevar, si es individual) **ni dónde es**. La dirección ya está en Configuración y **ya viaja en el HTML** de `/prova` (`contact.address`), pero el pie solo pinta teléfono, WhatsApp y correo. Sin mapa. | `/prova`, todos | HTML de `/prova` contiene `"address":"Carrer de la Mare de Déu dels Desemparats, 14-16, Gràcia…"`; `components/center-contact-line.tsx` no la usa | medio | S (dirección y mapa) / M (textos) | Mostrar la dirección con enlace a Google Maps en `/prova` (y en la confirmación). Añadir 2–3 líneas de «qué incluye la prueba» que debe escribir Raul. |
| C5 | Conversión | **En móvil la rejilla horaria es larga para tan poco:** 30 filas (07:00–22:00) para encontrar unas pocas franjas; la primera libre de mañana aparece a ~900 px y la leyenda (antelación de 24 h) va al final. | `/prova`, 320–414 px | captura 01; `provaFirstFreeY = 900` | medio | M | En móvil, sustituir la rejilla por una **lista de horas libres** del día («15:00 · 15:30 · 16:00…») con selector de días arriba; mover la frase de la antelación encima. |
| C6 🟣 | Conversión | **Registro largo para un primer contacto:** teléfono y fecha de nacimiento obligatorios, cinco campos opcionales de salud/físicos, idioma y código de referido. Para quien solo quiere probar, `/prova` es mejor camino, pero la pantalla de entrada pone «Crear cuenta» por delante. | `/register`, todos | captura 09 | medio | S–M | Decidir qué es obligatorio de verdad al darse de alta. Propuesta: nombre, correo, contraseña y teléfono; el resto, después, dentro de la app. |
| C7 🟣 | Conversión | **Faltan señales de confianza** para alguien de Gràcia que no conoce el centro: fotos reales del espacio y del equipo, reseñas, Instagram, horario público, mapa. Hoy solo hay una ilustración genérica. | todas | revisión visual | medio | M | Que Raul aporte fotos y textos. Las reseñas solo si son reales (por ejemplo, enlazar la ficha de Google). No se ha inventado ninguna. |

### 1. Diseño y maquetación responsive

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 🟣 | Diseño | **Las fuentes de marca no se aplican.** Lora (títulos) y Roboto Condensed (cuerpo) se descargan y se precargan (2 ficheros, 84 KB), pero el estilo calculado de `h1`, `h2` y `body` es `ui-sans-serif, system-ui…`: la app entera se ve con la fuente del sistema. Causa: `--font-sans: var(--font-roboto-condensed)` se define en `:root` (`@theme inline` de `app/globals.css`), pero `--font-roboto-condensed` solo existe en `<body>` (clase de `next/font` en `app/layout.tsx`), así que en `:root` la variable queda vacía. Viene del commit `6a194ab`. | toda la app (también admin y profesional), todos los motores | `getComputedStyle(h1).fontFamily` en producción; `document.fonts` sin ninguna cargada en uso; 2 `.woff2` de 37 y 46 KB | medio | S | **Decisión:** la app lleva meses con este aspecto. O se aplican de verdad (poner las clases de `next/font` en `<html>` en vez de `<body>`, y revisar todas las pantallas porque cambia el ancho de los textos), o se quitan y se ahorran 84 KB por visita. |
| D2 | Diseño | **En horizontal en móvil la primera pantalla es solo el panel de marca**: el formulario empieza a ~350 px en una pantalla de 375 px de alto. | `/login`, `/register`; 812×375 y 667×375, los 3 motores | captura 06 | medio | S | Con poca altura (`max-height: 500px`), compactar el panel: logo y titular en una línea, sin tarjetas. |
| D3 | Diseño | **En vertical el panel ocupa ~53 % de la primera pantalla** antes del formulario (430 de 812 px). | `/login`, `/register`; 320–414 px | capturas 05 y 09 | medio | S | En móvil, dejar solo logo + titular (las tres tarjetas, abajo o fuera). Va junto con C3. |
| D4 | Diseño | En 320 px, la cabecera de las páginas legales pega el logo al menú (0 px de separación) y «AVÍS LEGAL» parte en dos líneas. | `/legal/*`, 320 px, los 3 motores | captura 08; `logo.right = nav.left = 82 px` | bajo | S | `gap` entre logo y menú y `whitespace-nowrap` en los enlaces, o el menú debajo del logo por debajo de 360 px. |
| D5 | Diseño | En 1024×768 las tres tarjetas del panel se estrechan y el texto ocupa 4 líneas. | `/login`, `/register`; 1024 | captura 07 | bajo | S | Entre 1024 y 1279 px, tarjetas en una columna o solo títulos. |
| D6 | Diseño | **Etiquetas inconsistentes en el registro**: unas en MAYÚSCULAS («NOM COMPLET», «TELÈFON»…, componente `Field`) y otras en tipo frase («Contrasenya», «Repeteix la contrasenya», `PasswordField`); en el login todas van en tipo frase. | `/register`, todos | captura 09 | bajo | S | Unificar en un solo estilo (tipo frase, como el login, se lee mejor). |
| D7 | Diseño | El `h1` de `/prova` va en peso normal y sin la composición de marca del login; parece de otra app. | `/prova` | captura 03 | bajo | S | Mismo estilo de título que el login y algo del panel de marca arriba. |
| D8 | Diseño | El logo es un PNG de 299×120 que se pinta a 48 px de alto: en pantallas de densidad 3 (iPhone) necesitaría 144 px y se ve ligeramente blando. | `/login`, `/register`; iPhone | `sips` del fichero | bajo | S | Logo en SVG (o PNG a 3×). |
| D9 | Diseño | Sin modo oscuro: con el sistema en oscuro, la web se ve igual (clara). Es coherente, pero no declara `color-scheme` ni `theme-color`, y la barra del navegador no toma el color de marca. | todas | captura 11 | bajo | S | `color-scheme: light` y `<meta name="theme-color">` con el lila. Un modo oscuro de verdad no compensa hoy. |
| D10 | Diseño | No hay reglas de `prefers-reduced-motion`. Hoy apenas hay animaciones (2 reglas de transición), así que el efecto real es nulo. | todas | hoja de estilos | bajo | S | Añadirlas si se incorporan animaciones. |

### 2. Rendimiento

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Rendimiento | `/prova` bloquea el hilo principal 310 ms en móvil (TBT; el resto de páginas, <30 ms): pinta la rejilla entera (30 filas × días) y calcula la disponibilidad de cada celda en el navegador. Riesgo de INP flojo en móviles modestos. | `/prova`, móvil | Lighthouse, mediana de 3 | medio | M | Con C5 (lista de horas en móvil) se resuelve casi solo; si no, calcular las franjas libres en el servidor y enviar solo esas. |
| P2 | Rendimiento | Todas las páginas públicas van con `cache-control: no-store` (son dinámicas porque leen la cookie de idioma), así que no entran en la caché de ida y vuelta del navegador (bfcache) y cada visita se renderiza en el servidor. | todas | cabeceras; Lighthouse `bf-cache` | bajo | M | Las legales y el login podrían ser estáticas por idioma si el idioma fuera en la URL (ver S4). No urge: el TTFB es bueno. |
| P3 | Rendimiento | Las imágenes de `/public` se sirven con `max-age=0` (se revalidan cada visita). La ilustración pesa 149 KB en WebP. | escritorio | `curl -I /images/hero-entrenament.webp` | bajo | S | Caché larga con nombre versionado y versión AVIF (~60–80 KB). |
| P4 | Rendimiento | 84 KB de fuentes descargadas y precargadas que no se usan. | todas | ver D1 | bajo | S | Se resuelve con D1. |

### 3. Accesibilidad (WCAG 2.2 AA)

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Accesibilidad | **Contraste insuficiente del gris secundario** `#777777`: 4,47:1 sobre blanco y 4,18:1 sobre `#f7f7f7` (mínimo 4,5:1). Afecta a subtítulos, pie legal, leyendas y «Ja tens compte? Entra». Es la única infracción de axe en todas las páginas (de 1 a 27 elementos por página). | todas, los 3 idiomas | axe `color-contrast` (serious); Lighthouse | medio | S | Oscurecer `--color-brand-muted` a ~`#6b6b6b` (5,3:1 / 4,9:1). El proyecto ya hizo lo mismo con `--color-brand-tab`. Afecta a toda la app: revisar a la vez. |
| A2 | Accesibilidad | **El modal de `/prova` no es un diálogo accesible**: sin `role="dialog"` ni `aria-modal`, el foco no entra al abrirlo (se queda en el botón «Lliure» de detrás), **Escape no lo cierra** y se puede tabular por detrás. | `/prova`, todos | Playwright: `role=null`, `focusInside=false`, Escape → sigue abierto; captura 02 | medio | S | Usar `<dialog>` nativo (`showModal()`) o `role="dialog" aria-modal="true" aria-labelledby`, foco al primer campo, Escape para cerrar y devolver el foco a la franja. |
| A3 | Accesibilidad | **Los botones de franja solo dicen «Lliure»**: con lector de pantalla son 45 botones idénticos sin día ni hora, y con teclado hay que pasar por todos antes de llegar al contacto. | `/prova` | árbol de accesibilidad; recorrido con tabulador | medio | S | `aria-label="Reservar dimecres 14 d'octubre, 15:00"` en cada uno (traducido). Con C5 (lista) mejora también el recorrido. |
| A4 | Accesibilidad | **Los campos tienen 14 px de letra**: Safari en iPhone hace zoom automático al tocar cualquier campo y descoloca la pantalla. | `/login`, `/register`, `/prova` (modal), selector de idioma; WebKit móvil | `getComputedStyle(input).fontSize = 14px` | medio | S | `font-size: 16px` en `input`, `select` y `textarea` por debajo de 640 px. |
| A5 | Accesibilidad | El botón «Mostrar la contraseña» mide 22×22 px (mínimo 24×24 en WCAG 2.5.8). Los enlaces del pie (15 px de alto) están en el límite. | `/login`, `/register` | medición de zonas táctiles | bajo | S | Área de toque de 44×44 (padding) sin cambiar el icono. |
| A6 | Accesibilidad | En login y registro el primer encabezado es un `h2` (panel de marca) y el `h1` viene después. | `/login`, `/register` | árbol de encabezados | bajo | S | Que el titular del panel no sea encabezado (o sea el `h1` de una portada, con C1). |
| A7 | Accesibilidad | Los errores de los formularios no se anuncian: el `<p>` de error no tiene `role="alert"` ni `aria-live`, y los campos no se marcan con `aria-invalid`. | `/login`, `/register` y modal de `/prova` (código) | `login-panel.tsx`, el `<p className="text-sm text-error">` | bajo | S | `role="alert"` en el mensaje y `aria-describedby` en el campo afectado. |
| A8 | Accesibilidad | ✅ Correcto: `lang` del `<html>` sigue el idioma; todos los campos tienen etiqueta; zoom al 200 % sin scroll horizontal; foco visible en enlaces y botones (contorno del navegador) y en campos (anillo lila); landmarks `main` presentes. | todas | axe, Playwright, captura 12 | — | — | Nada que hacer. |

### 4. SEO y compartir

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | SEO | **No hay `robots.txt` ni `sitemap.xml`** (los dos dan 404). | dominio | `curl` → 404 | alto | S | `app/robots.ts` (permitir `/`, `/prova`, legales; bloquear `/admin`, `/trainer`, `/client`, `/auth`, `/api`) y `app/sitemap.ts`. |
| S2 | SEO | **Sin Open Graph ni Twitter Card.** Al compartir el enlace por WhatsApp o Instagram no sale imagen, y el texto es el genérico. | todas | 0 etiquetas `og:` en el HTML | alto | S | `openGraph` y `twitter` en los metadatos de Next, con imagen de 1200×630 (logo + foto real, decisión de Raul) y título/descripción por idioma. `/prova` es la URL que más se compartirá. |
| S3 🟣 | SEO | **Sin datos estructurados** (`LocalBusiness` / `HealthClub` / `ExerciseGym` / `Physiotherapy`). La dirección y el teléfono ya están en Configuración → Centro; el **horario público no está en ninguna parte** (las horas 07–22 de la agenda son de reservas, no necesariamente de apertura). | `/` o `/login` | HTML sin `application/ld+json` | alto | M | JSON-LD con nombre, dirección de Gràcia, teléfono, `geo`, `url`, `sameAs` (Instagram) y `openingHoursSpecification` **cuando Raul confirme el horario**. Dar de alta o revisar la ficha de Google Business Profile, que para un centro de barrio pesa más que la web. |
| S4 | SEO | **El idioma va solo por cookie**: la misma URL sirve ca, es y en, no hay `hreflang` ni `canonical`, y la primera visita **ignora `Accept-Language`** (un navegador en inglés o castellano ve catalán). Google indexará solo la versión catalana. | todas | `curl -H "Accept-Language: en"` → `lang="ca"`; `lib/i18n/resolve.ts` | medio | S (detección) / L (URL por idioma) | Rápido: si no hay cookie, elegir el idioma por `Accept-Language` en el middleware. A más largo plazo, rutas por idioma (`/es/prova`, `/en/prova`) con `hreflang` y `canonical`, solo para las páginas públicas. |
| S5 | SEO | **Títulos y descripciones incompletos:** `/register`, `/forgot-password`, `/auth/*` se titulan solo «VindiBCN»; las legales y la 404 heredan la descripción interna «Gestió del centre d'entrenament personal i fisioteràpia», **en catalán en los tres idiomas**. | `/register`, `/forgot-password`, `/auth/*`, `/legal/*`, 404 | `document.title` y `meta description` en ca/es/en | medio | S | `generateMetadata` traducido en cada página, y cambiar la descripción por defecto del layout raíz por una pública y traducida. |
| S6 🟣 | SEO | **La portada que verá Google es un login**: `/` → 307 (temporal) → «Entrar · VindiBCN». | `/` | `curl -I /` | medio | S–L | Depende de C1. Si se queda así, que la redirección sea 308 y que el título de `/login` describa el centro, no la acción de entrar. |
| S7 🟣 | SEO | **Dominio `vercel.app`**: resta confianza, no acumula autoridad de marca y, si un día se cambia, habrá que redirigir. Las URL de despliegues de vista previa de Vercel también son públicas. | dominio | — | medio | M | Dominio propio (pendiente, decisión de Marc), con 301 desde `vindibcnapp.vercel.app` y `noindex` en las vistas previas. Hacerlo **antes** de invertir en SEO o en enlaces compartidos. |
| S8 | SEO | Páginas que no deberían indexarse no lo indican: `/register`, `/forgot-password`, `/auth/*`. `/prova` sí debe indexarse (y hoy es indexable). | esas rutas | sin `robots` meta | bajo | S | `robots: { index: false }` en los metadatos de esas rutas. |
| S9 | SEO | Sin `manifest.webmanifest` (no se puede «añadir a pantalla de inicio» con nombre e icono propios). Favicon e icono de Apple, correctos (512 px). | dominio | `curl` → 404 | bajo | S | `app/manifest.ts` con nombre, colores e iconos. Útil para los clientes que usan la app a diario. |

### 5. Textos y los tres idiomas

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Textos | **«ÀREA CLIENT» está fijo en catalán** también en castellano e inglés (único texto sin traducir de la parte pública). | `/login`, `/register`, es y en | `components/auth/brand-panel.tsx:71`; captura 05 | medio | S | Llevarlo a `messages/*` (`brand.badge`: «Àrea client» / «Área cliente» / «Client area»). |
| T2 | Textos | **Los errores de Auth del login y del registro se muestran tal cual llegan de Supabase, en inglés** (p. ej. «Invalid login credentials», «User already registered»). Para el admin ya existe `authErrorCa`, pero el cliente no lo usa. **No verificado en vivo** (habría que intentar entrar con credenciales). | `/login`, `/register`, los 3 idiomas | `login-panel.tsx:112` (`setError(signInError.message)`), `register-panel.tsx:158` | medio | S | Una versión trilingüe del traductor de errores de Auth para login y registro (credenciales incorrectas, correo sin confirmar, demasiados intentos, correo ya registrado). |
| T3 | Textos | Errata: «He llegit i accepto la Política de Privacitat **i l' Avís Legal**» (espacio después del apóstrofo). | `/register`, ca | captura 09; `register.acceptMid = "i l'"` + espacio en el JSX | bajo | S | Unir la `l'` al enlace sin espacio en catalán (mejor una sola frase con `t.rich`). |
| T4 | Textos | El desplegable de género repite «Prefereixo no dir-ho» / «Prefer not to say»: es el valor vacío por defecto y también una opción. | `/register`, los 3 idiomas | opciones: `Prefer not to say[vacío], Man, Woman, Other, Prefer not to say` | bajo | S | Que el vacío diga «—» o «Selecciona…», o quitar la opción duplicada. |
| T5 | Textos | El mensaje tras crear la cuenta es técnico: «Revisa el teu correu **si la confirmació per email està activada**». | `/register` (tras enviar), los 3 idiomas | `messages/*.json` `register.createdBody` | bajo | S | Decir lo que pasa de verdad en producción («Te hemos enviado un correo para confirmar la cuenta» o «Ya puedes entrar»). |
| T6 🟣 | Textos | «Benvingut de nou / Bienvenido de nuevo» es masculino genérico y, como la pantalla es también la entrada pública, se lo dice a quien viene por primera vez. | `/login` | — | bajo | S | Alternativa neutra: «Hola de nou» / «Te damos la bienvenida» / «Welcome». Decisión de tono. |
| T7 | Textos | En inglés, el panel dice «passes» (vocabulario fijado) y el aviso legal «session packages». | `/login`, `/legal/avis-legal`, en | textos renderizados | bajo | S | Usar «passes» también en el aviso legal (si el asesor no prefiere otra cosa). |
| T8 | Textos | No hay selector de idioma en las páginas legales, `/forgot-password` ni la 404: solo se cambia desde el login, el registro o `/prova`. | esas rutas | revisión | bajo | S | Añadir el `LanguageSwitcher` a la cabecera legal y a recuperar contraseña. |
| T9 | Textos | ✅ Correcto: las traducciones es/en están completas y suenan naturales; el cambio de idioma funciona y se recuerda un año (verificado: cambiar a castellano en `/login` → `/prova` sale en castellano y `<html lang="es">`). | — | Playwright | — | — | Nada que hacer. |

### 7. Legal y privacidad (⚖️ las decisiones son del asesor; aquí solo se señala lo que falta)

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 ⚖️ | Legal | **Los tres textos legales están publicados como borrador**, con aviso de «Document provisional» y marcadores visibles: «[A concretar amb l'assessor.]», «[Barcelona]», «[A validar per l'assessor.]», «[a revisar per l'assessor]», «[Concretar terminis amb l'assessor.]», «[Confirmar l'inventari real amb l'assessor abans de publicar.]». | `/legal/*`, los 3 idiomas | texto visible en producción | alto | S (cuando haya texto) | Pasar los tres textos al asesor y sustituir los marcadores. |
| L2 ⚖️ | Legal | **Stripe no figura entre los encargados del tratamiento**, aunque se cobra con Stripe (bonos, vales, suscripciones). Tampoco se concretan ubicación de servidores ni transferencias internacionales (Vercel, Resend y Stripe son empresas de EE. UU.). | `/legal/privacitat` | texto de la política | alto | S | Añadir Stripe y lo que diga el asesor sobre transferencias. |
| L3 ⚖️ | Legal | **Datos de salud en el alta con un solo check general.** El registro pide (opcionalmente) peso, altura y «objetivo» (el ejemplo cita «rehabilitación»), y la política dice que los datos de salud se tratan con «consentimiento expreso», pero en el formulario solo hay «He leído y acepto la Política de Privacidad y el Aviso Legal». | `/register` | captura 09; texto de la política | medio | S–M | Que el asesor diga si esos campos necesitan un consentimiento separado en el alta o si conviene pedirlos más tarde. |
| L4 ⚖️ | Legal | **La solicitud de prueba recoge datos de no clientes** (nombre, correo, teléfono, IP para el antiabuso) y la política no menciona esa finalidad ni cuánto se guardan esos datos si la persona no se hace clienta. | `/prova`, `/legal/privacitat` | `app/prova/actions.ts` (guarda la IP); texto de la política | medio | S | Añadir la finalidad «gestionar la sesión de prueba» y su plazo de conservación. |
| L5 ⚖️ | Legal | La política de cookies dice que solo hay cookies técnicas de autenticación, pero en la parte pública la única cookie es **`vindi_locale`** (preferencia de idioma, 1 año), que no aparece. **No hay cookies ni peticiones de terceros** (ni analítica, ni mapas, ni fuentes externas: las fuentes se sirven desde el propio dominio), así que hoy no parece hacer falta banner. | `/legal/cookies` | `context.cookies()` tras navegar: solo `vindi_locale`; ninguna petición a otro dominio | bajo | S | Añadir `vindi_locale` al inventario. **Si se añade analítica, un mapa incrustado de Google o vídeo de terceros, sí hará falta banner**: mejor enlazar al mapa que incrustarlo. |
| L6 ⚖️ | Legal | Consentimiento presente y correcto en forma: casilla sin marcar en `/prova` y en el registro, con enlace a la política. Los datos del responsable (titular, NIF, domicilio, correo) aparecen en el aviso legal y en la privacidad. | — | capturas 02 y 09 | — | — | Confirmar con el asesor que el titular es la persona física y no una sociedad, y si debe figurar el número de colegiado del fisioterapeuta. |

### 8. Técnico y seguridad

| id | frente | qué pasa | dónde | evidencia | impacto | esfuerzo | propuesta concreta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| X1 | Técnico | **Faltan cabeceras de seguridad.** Hay `Strict-Transport-Security` (2 años, `preload`), pero no hay `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (el login se puede incrustar en un iframe ajeno: clickjacking), `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`. Además `x-powered-by: Next.js` anuncia la tecnología. | todas | `curl -I /login`; Lighthouse `csp-xss` | medio | S (las simples) / M (CSP) | `headers()` en `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, y `poweredByHeader: false`. La CSP, aparte y en modo `Report-Only` primero (Stripe, Supabase y los scripts en línea de Next). **Toca configuración: parar antes del push.** |
| X2 | Técnico | `/prova` envía al navegador los **UUID de los 3 profesionales**, sus franjas semanales, sus horas ocupadas día a día durante 30 días y sus bloqueos (p. ej., del 24/12 al 01/01). No hay nombres ni datos de clientes, pero es más de lo que hace falta para pintar huecos libres. | `/prova` | HTML de `/prova` (`rules`, `busy`, `blocks`) | bajo | M | Calcular en el servidor las franjas libres y enviar solo eso (va junto con P1). |
| X3 | Técnico | ✅ **Nada privado expuesto**: buscadas en el HTML y en los 18 ficheros JS públicos claves de Stripe (`sk_`, `whsec_`), Resend (`re_`), la clave de servicio de Supabase, `CRON_SECRET` y JWT: ninguna. Solo aparecen la URL de Supabase (pública por diseño, la protege la RLS) y el contacto del centro (público a propósito). | todas | `grep` sobre lo descargado | — | — | Nada que hacer. |
| X4 | Técnico | ✅ **Sin errores**: ningún error de consola (solo el 404 esperado de la página inexistente), ninguna petición fallida (solo precargas de Next canceladas al navegar, normales), ningún enlace roto (todos los internos dan 200; `wa.me`, `tel:` y `mailto:` correctos). `/admin` y `/client` redirigen al login con `redirectedFrom`. | todas, 3 motores | barrido de Playwright; `curl` de cada enlace | — | — | Nada que hacer. |
| X5 | Técnico | Ficheros sobrantes de la plantilla de Next en `/public` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) y `logo_vindi.png` (512×512, igual que el icono), públicos y sin uso. | `/public` | `curl` → 200; sin referencias en el código | bajo | S | Borrarlos. |
| X6 | Técnico | La cookie `vindi_locale` se crea sin `Secure` (no es sensible). | todas | `context.cookies()` | bajo | S | Añadir `secure: true` en producción. |

---

## Plan por fases

### Fase 1 · Arreglos rápidos de alto impacto (1–2 días, sin decisiones de contenido)

1. **C2** — `/prova` abre en el primer día con huecos y avisa cuando un día no tiene.
2. **C3 + D3** — En móvil, el botón de la prueba arriba, en el panel de marca, y el panel más bajo.
3. **C4 (parte técnica)** — Dirección con enlace a Maps en `/prova`.
4. **S1, S2, S5, S8** — `robots.txt`, `sitemap.xml`, Open Graph/Twitter, títulos y descripciones traducidos, `noindex` en registro/contraseña/auth. *(La imagen de OG: 🟣 elegir foto.)*
5. **S4 (parte rápida)** — Idioma por `Accept-Language` en la primera visita.
6. **A1, A2, A3, A4** — Gris secundario a AA, modal accesible, botones de franja con día y hora, campos a 16 px en móvil.
7. **T1, T2, T3, T4, T5** — «Àrea client» traducido, errores de Auth en tres idiomas, erratas del registro.
8. **X1 (sin CSP)** — Cabeceras básicas de seguridad y fuera `x-powered-by`. ⚠️ Es configuración: **parar antes del push** y enseñar las pruebas.

### Fase 2 · Mejoras medianas (una semana)

1. **D1** 🟣 — Decidir si se aplican las fuentes de marca (y revisar toda la app) o se quitan.
2. **C5 + P1 + X2** — Lista de horas libres en móvil y franjas calculadas en el servidor.
3. **S3** 🟣 — JSON-LD de negocio local con los datos de Configuración y el horario que confirme Raul; revisar la ficha de Google Business Profile.
4. **C6** 🟣 — Simplificar el registro (qué es obligatorio).
5. **D2, D4, D5, D6, D7, D8, D9** — Horizontal en móvil, cabecera legal en 320, tarjetas en 1024, etiquetas unificadas, título de `/prova`, logo en SVG, `theme-color`.
6. **A5, A6, A7, T7, T8, S9, P3, X5, X6** — Detalles de accesibilidad, textos, manifest, caché de imágenes y limpieza.
7. **L1–L5** ⚖️ — Revisión de los textos legales con el asesor (Stripe, salud, prueba, cookies).

### Fase 3 · Más recorrido

1. **C1 + C7 + S6** 🟣 — Portada pública del centro (o enlace a la web de marketing si existe) con servicios, equipo, fotos reales, ubicación, contacto y la prueba como acción principal. Necesita contenido de Raul.
2. **S7** 🟣 — Dominio propio, redirección 301 desde `vercel.app` y `noindex` en vistas previas. Mejor **antes** de la portada y de cualquier campaña.
3. **S4 (completo)** — URL por idioma (`/es/…`, `/en/…`) para las páginas públicas, con `hreflang` y `canonical`.
4. **X1 (CSP)** — Política de seguridad de contenidos, primero en `Report-Only`.
5. **P2** — Páginas públicas estáticas por idioma (bfcache y menos trabajo de servidor).
6. Medir: Vercel Analytics/Speed Insights (sin cookies) para tener datos reales de Core Web Vitals e INP. ⚖️ Confirmar con el asesor si cambia la política de cookies.

### Decisiones pendientes de Marc o Raul

| Tema | Pregunta | Hallazgos |
| --- | --- | --- |
| Portada | ¿Hay (o habrá) otra web del centro? ¿O esta debe tener portada pública? | C1, C7, S6 |
| Contenido | Fotos reales del centro y del equipo, texto de qué incluye la prueba, horario público, Instagram, reseñas reales (si se quieren mostrar). | C4, C7, S2, S3 |
| Tipografía | ¿Lora y Roboto Condensed o la fuente del sistema que se ve hoy? | D1 |
| Registro | ¿Qué datos son obligatorios al darse de alta? | C6 |
| Tono | Saludo del login («Benvingut de nou»). | T6 |
| Dominio | Cuál y cuándo. | S7 |
| Legal ⚖️ | Textos definitivos, Stripe, consentimiento de salud, datos de la prueba, inventario de cookies. | L1–L6 |

## Capturas

| Fichero | Qué muestra |
| --- | --- |
| [01-prova-375-avui-buit.jpg](auditoria-capturas/01-prova-375-avui-buit.jpg) | `/prova` en móvil: abre en hoy, sin ningún hueco (C2, C5) |
| [02-prova-375-modal.jpg](auditoria-capturas/02-prova-375-modal.jpg) | El modal de solicitud (A2) |
| [03-prova-1280-setmana-per-defecte.jpg](auditoria-capturas/03-prova-1280-setmana-per-defecte.jpg) | `/prova` en escritorio: abre en Semana y se ven los huecos; comparar con la 01 (C2, D7) |
| [05-login-en-390-webkit-primera-pantalla.jpg](auditoria-capturas/05-login-en-390-webkit-primera-pantalla.jpg) | iPhone (WebKit) en inglés: «ÀREA CLIENT» sin traducir y sin rastro de la prueba en la primera pantalla (T1, C3, D3) |
| [06-login-812x375-horitzontal.jpg](auditoria-capturas/06-login-812x375-horitzontal.jpg) | Móvil en horizontal: la primera pantalla es solo el panel (D2) |
| [07-login-1024-targetes-estretes.jpg](auditoria-capturas/07-login-1024-targetes-estretes.jpg) | 1024 px: tarjetas del panel con 4 líneas (D5) |
| [08-legal-320-capcalera-enganxada.jpg](auditoria-capturas/08-legal-320-capcalera-enganxada.jpg) | Cabecera legal a 320 px: logo pegado al menú (D4) |
| [09-register-320-etiquetes-i-apostrof.jpg](auditoria-capturas/09-register-320-etiquetes-i-apostrof.jpg) | Registro a 320 px: etiquetas mezcladas, «i l' Avís Legal», longitud del formulario (D6, T3, C6, L3) |
| [10-login-1920-referencia.jpg](auditoria-capturas/10-login-1920-referencia.jpg) | Escritorio grande: bien resuelto (referencia) |
| [11-login-375-mode-fosc.jpg](auditoria-capturas/11-login-375-mode-fosc.jpg) | Con el sistema en modo oscuro: se mantiene claro (D9) |
| [12-login-1280-focus-teclat.jpg](auditoria-capturas/12-login-1280-focus-teclat.jpg) | Foco de teclado visible (A8) |
