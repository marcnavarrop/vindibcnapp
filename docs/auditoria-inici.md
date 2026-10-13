# Auditoría del Inicio (admin, profesional y cliente)

**Fecha:** 13/10/2026 · **Código:** `main` en `02cf005` · **Tipo:** solo diagnóstico, sin cambios de código ni de datos.

Capturas en [`docs/auditoria-inici-capturas/`](auditoria-inici-capturas/).

---

## Resumen

Los tres Inicios **calculan bien**: cada número de la simulación cuadra con un recálculo independiente sobre los datos. No hay errores de consola ni scroll horizontal en ninguna de las 72 combinaciones probadas, el CLS es 0 y axe no encuentra nada en admin ni en profesional.

El problema es de **prioridad y de significado**, no de cálculo:

1. **Lo urgente queda abajo.** En el móvil, el admin ve seis números y cuatro botones antes de «Atención inmediata» (empieza a ~1.050 px, más de una pantalla abajo). El profesional no ve su agenda de hoy en la primera pantalla. El cliente ve su próxima sesión a medias, debajo de cuatro números y tres botones.
2. **Las cuentas demo se cuelan en los números de Raul (producción).** En octubre, 1.060 € de los 1.200 € de «Ingressos del mes» (el 88 %) son pagos de prueba del Client Demo. 4 de los 5 bonos «a punto de agotarse» también son suyos, y la ocupación incluye la disponibilidad del Entrenador Demo y del Fisio Demo, que no reservan.
3. **Algunos números dicen otra cosa de la que parece.**
   - «Sessions 10 avui», pero la lista de hoy muestra 8: esconde las ya marcadas como hechas.
   - «↑0,8 % vs setembre» compara lo que va de octubre con septiembre entero; con los mismos días sería +81 % (con los datos de prueba).
   - «19 clients a qui oferir renovació» son 19 *bonos* (en producción, 5 bonos son 2 clientes).
   - «de 15 programades» del cliente son sesiones *compradas*.
4. **Fallos concretos.**
   - La lista de próximas reservas del profesional **no enseña la hora**.
   - La asistencia del cliente dice «2 de 2 **aquest mes**» también en castellano e inglés.
5. **El profesional no ve lo que tiene que marcar.** Las sesiones sin marcar (que no se pagan hasta que se marcan) solo salen en el Inicio del admin.
6. **Saturación cuando hay datos.** El Inicio del profesional cargado mide 8,2 pantallas en el móvil: lista los 56 clientes enteros, 18 bonos y 5 anuncios completos.

Cada área tiene más abajo una maqueta del Inicio ideal, construida como HTML estático con los datos de prueba, sin tocar el código.

## Nota por área

| Área | Nota (0–10) | En una frase |
| --- | --- | --- |
| Admin | **6** | Mucha información y bien calculada, pero los avisos van detrás de los números, y en producción los números mezclan las cuentas demo. |
| Profesional | **5** | Le falta lo principal (su día con horas y lo que tiene que marcar) y le sobran listas enteras. |
| Cliente | **7** | Lo más cuidado de los tres; la próxima sesión debería ser lo primero, y hay un texto sin traducir y una etiqueta engañosa. |
| Coherencia entre áreas | **6** | Mismas piezas (números, botones rápidos, avisos), pero con criterios distintos; el cliente no tiene «avisos». |

## Cómo se ha medido

- **Simulación** (build de producción local con `NEXT_PUBLIC_USE_MOCK=true`), con cuatro estados del store:
  - **seed**: el de serie, con 4 clientes y reservas de junio; hoy queda casi vacío.
  - **vacío**: sin reservas, bonos, pagos ni avisos.
  - **normal**: 29 clientes y unas 180 reservas.
  - **cargado**: 64 clientes, unas 280 reservas, 12 sesiones sin marcar, 5 pruebas pendientes, 3 vales y 5 anuncios.

  Los estados se generan con un script del scratchpad sobre el archivo temporal de la simulación, que se ha restaurado al final.
- **Playwright** en Chromium (375, 390 y 1280) y WebKit (390 y 1280), con los 3 roles y los 4 estados: 72 combinaciones. Captura de la primera pantalla y de la página entera, altura, encabezados, enlaces y zonas táctiles.
- **Datos:** cada número de la simulación se ha recalculado desde el store, sin pasar por el código de la app. En **producción**, lectura de solo lectura de la base (script temporal, ya borrado) para saber qué deberían ver las cuentas demo y cuánto pesan en los números del centro.
- **Acciones:** todos los enlaces de cada Inicio, con su destino y su respuesta.
- **Accesibilidad:** axe (WCAG 2.2 AA) en el estado normal a 375 y 1280, en ca/es/en para el cliente, y recorrido con tabulador.
- **Rendimiento:** CLS medido en Chromium; consultas contadas leyendo el código.

**Pendiente (necesita a Marc):**
- Medir el tiempo de servidor real y comprobar en pantalla los números de producción con las cuentas demo. Necesito que entres en el navegador integrado y cambies de cuenta con el modo PRE; yo solo leo.
- La simulación no mide tiempos reales: no tiene base de datos.

---

## Datos: ¿cuadran?

**Simulación, estado cargado:** cuadran todos.

| Área | Número en pantalla | Recalculado |
| --- | --- | --- |
| Admin | Ingressos 11.050 € · ↑0,8 % | 11.050 € (oct) / 10.965 € (sep) → +0,8 % ✓ (pero ver A4) |
| Admin | Pendent de cobrament 4.000 € · 10 bons | 10 bonos `pending_payment` vigentes, 4.000 € ✓ |
| Admin | Bons a punt d'esgotar-se 19 | 19 bonos activos con ≤1 sesión ✓ (son bonos, ver A5) |
| Admin | Sessions 10 avui · 43 setmana | 10 / 43 (reservadas + hechas) ✓ · la lista de hoy enseña 8 (A3) |
| Admin | Conversió 37,5 % · 3 de 8 | 3 / 8 ✓ |
| Admin | Atenció: 3 proves · 3 vals · 7 sense entrenador | 3 pruebas vigentes (2 ya caducadas) · 3 · 7 ✓ |
| Admin | Sense marcar 20 | 20 ✓ |
| Profesional (Laia) | Sessions 7 / 33 · 56 clients · 18 bons | 7 / 33 · 56 · 18 ✓ |
| Cliente (Ana) | 5 restants de 15 · 2 bons · 4 properes | 5 / 15 · 2 · 4 ✓ |

**Producción (lectura de la base, 13/10/2026):**

| Qué | Valor | De ello, cuentas demo |
| --- | --- | --- |
| Ingresos de septiembre | 1.965 € (9 pagos) | **1.245 € (7) del Client Demo** |
| Ingresos de octubre | 1.200 € (8 pagos) | **1.060 € (7) del Client Demo: el 88 %** |
| Bonos activos con ≤1 sesión | 5 bonos, 2 clientes | **4 del Client Demo** |
| Reglas de disponibilidad (base de la ocupación) | 53 | **12 del Entrenador Demo y el Fisio Demo**, sin reservas esta semana |
| Pendiente de cobro | 2 bonos, 500 € | 0 |
| Client Demo (lo que debería ver) | 14 bonos activos, 60 de 75 sesiones; próximas: 28/10, 4/11 y 11/11 a las 12:00, Fisioterapia | — |
| Entrenador Demo | 1 cliente asignado; 0 sesiones esta semana | — |

Queda por comprobar que la pantalla de producción enseña exactamente esto (pendiente de la sesión con Marc).

---

## Tabla de hallazgos

Impacto: **alto / medio / bajo**. Esfuerzo: **S** (horas), **M** (1–2 días), **L** (más). 🟣 = necesita una decisión de Marc o de Raul.

### Admin

| id | área | qué pasa | evidencia | impacto | esfuerzo | propuesta |
| --- | --- | --- | --- | --- | --- | --- |
| A1 🟣 | Admin | **Las cuentas demo entran en los números del centro.** Ingresos (88 % de octubre), bonos bajos (4 de 5) y ocupación (12 reglas demo en el denominador). Raul ve un negocio que no es el suyo. | Lectura de producción (tabla de arriba); `lib/data/dashboard.ts` no filtra por `lib/demo-accounts.ts` | alto | M | Excluir las cuentas demo de los números del Inicio del admin (ingresos, pendientes, bonos, sesiones, ocupación y conversión), con la misma regla «demo con demo» del resto de la app. Una línea pequeña: «sin cuentas demo». **Decisión:** ¿se excluyen siempre o solo fuera del modo PRE? |
| A2 🟣 | Admin | **Lo urgente va detrás.** Seis números y cuatro botones grandes antes de «Atención inmediata». En el móvil, los avisos empiezan a ~1.050 px, y «Avui al centre» y «Sense marcar» aún más abajo. | Capturas 01 y 02; página cargada de 4,5 pantallas en el móvil | alto | M | Orden: **Por resolver** (avisos con su botón) → **Hoy en el centro** → **Cómo va el centro** (números) → renovaciones. Los botones rápidos, a la cabecera. Maqueta 10/11. |
| A3 | Admin | **«Sessions 10 avui» y la lista «Avui al centre» enseña 8.** El número cuenta reservadas y hechas; la lista solo las reservadas, así que las ya marcadas desaparecen. | Recálculo: 8 `booked` + 2 `completed`; `app/(admin)/admin/page.tsx` (`filter(status === "booked")`) | medio | S | Lista del día entera con el estado de cada sesión (hecha · por marcar · ahora · por hacer), así número y lista dicen lo mismo. |
| A4 🟣 | Admin | **La variación de ingresos compara lo que va de mes con el mes anterior entero.** A principio de mes siempre parece que va mal. Con los datos cargados: +0,8 % en pantalla, +81 % comparando del 1 al 13 de cada mes. | `toRevenue` en `lib/data/dashboard.ts`; recálculo sobre el store | medio | S | Comparar los mismos días del mes anterior («vs 1–13 de septiembre»), o quitar el porcentaje. **Decisión de Raul:** qué número le sirve. |
| A5 | Admin | **«Bons a punt d'esgotar-se».** Dice «19 clients» y cuenta bonos (en producción, 5 bonos son 2 clientes). Incluye bonos con 0 sesiones. Sale dos veces (número arriba y lista abajo), la lista no tiene tope (19 filas) y el número lleva a `/admin/bonos` sin filtrar. | Capturas 02/03; `components/admin/home-sections.tsx:134` | medio | S | Contar clientes distintos, una sola pieza, los 5 primeros y «Ver todos (19)», y un enlace a la lista ya filtrada. |
| A6 | Admin | **≈ 50 consultas por cada apertura del Inicio** (lectura del código). Unas 31 son de «Fora de disponibilitat»: `findOrphans` hace 5 por profesional (reservas, pruebas, esperas, reglas y bloqueos), y en producción hay 6. | `lib/data/admin-agenda-health.ts` (`outOfAvailability`), `lib/data/availability-orphans.ts` | medio | M | Una sola lectura de todos los profesionales (reglas, bloqueos y compromisos de la ventana) y el cálculo en memoria; o calcularlo solo cuando se abre la tarjeta. Medir antes y después en producción. |
| A7 | Admin | Los cuatro botones rápidos ocupan ~350 px en el móvil y repiten entradas del menú. | Captura 01 | bajo | S | Dos botones en la cabecera («+ Reserva», «+ Cliente»); el resto ya está en el menú. |
| A8 | Admin | «Avui al centre» no distingue lo pasado, lo que pasa ahora y lo que viene, y no deja marcar desde aquí (hay que ir a la agenda). | Captura 03 | bajo | M | Estado en cada fila y «Marcar hecha» en las pasadas, como en la maqueta. |

### Profesional

| id | área | qué pasa | evidencia | impacto | esfuerzo | propuesta |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Profesional | **«Properes reserves» no enseña la hora**: «14 d'oct. del 2026 · Biel Costa». Con seis reservas del mismo día no se sabe cuándo es cada una. | Captura 05; `components/trainer-upcoming-reservations.tsx:74` (solo `formatDate`) | alto | S | Hora en grande y día relativo («Hoy 18:00», «Mié 14 · 09:00»), sin el año. |
| P2 | Profesional | **Su día no aparece en la primera pantalla.** Primero van cuatro números, tres botones y los avisos; la lista mezcla días y no separa «hoy». | Captura 04 | alto | M | Empezar por **El teu dia**: las sesiones de hoy con hora y estado, la próxima destacada. Maqueta 12/13. |
| P3 🟣 | Profesional | **Las sesiones sin marcar no salen en su Inicio**, aunque es quien las marca y no se pagan hasta que se marcan. Solo las ve el admin. | Inicio del profesional sin la tarjeta; el admin muestra «Laia Puig 17» | alto | M | Añadir sus sesiones sin marcar a «Per fer», con el botón que lleva a marcarlas. **Decisión:** ¿el profesional puede marcar todas las suyas? (hoy, sí desde Reservas). |
| P4 | Profesional | **«Els meus clients» lista todos los asignados**: con 56, 6,7 pantallas en escritorio y 8,2 en el móvil. Además, `listClients` los carga todos con sus bonos y sin límite, solo para esta lista y un número. | Captura 05; `lib/data/clients.ts:375` | medio | S | Quitar la lista del Inicio (ya está en Clients) o enseñar 5. El número, con el recuento que ya calcula `getTrainerDashboard`. |
| P5 | Profesional | Bonos bajos: lista sin tope (18), número repetido arriba y abajo, y «clients» que son bonos. | Captura 05 | medio | S | Como A5. |
| P6 | Profesional | La cabecera repite «56 clients assignats», que ya está en un número justo debajo. | Captura 04 | bajo | S | En la cabecera, «Avui tens 7 sessions · la pròxima a les 18:00». |
| P7 | Profesional | Las próximas reservas no enlazan a nada (no se pueden abrir ni marcar), y cada fila lleva «Afegir al calendari», que tiene poco sentido para su agenda de trabajo. | Enlaces del Inicio: ninguno a reservas | bajo | S | Fila enlazada a la ficha de la reserva; el calendario, solo en el detalle. |
| P8 | Profesional | «Revisar» de las pruebas lleva a `/trainer/reservas` en general, no a la prueba. | Enlaces del Inicio | bajo | S | Llevar a la prueba (o a su día con la prueba abierta). |
| P9 | Profesional | A 390 px, la cabecera «Properes reserves · Mostra: Els meus / Tots» se parte en dos líneas. | Captura 06 | bajo | S | Interruptor debajo del título, o un solo botón. |
| P10 | Profesional | La Comunidad enseña todos los anuncios completos al final. | Captura 05 | bajo | S | El último y «Todos →». |

### Cliente

| id | área | qué pasa | evidencia | impacto | esfuerzo | propuesta |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Cliente | **Texto sin traducir:** «2 de 2 **aquest mes**» sale en catalán también en castellano e inglés. | Texto renderizado en es/en; `components/client/home-sections.tsx:59` escrito a mano | alto | S | Llevarlo a `messages/*` («2 de 2 este mes» / «2 of 2 this month»). |
| C2 | Cliente | **La próxima sesión no es lo primero**: va debajo de cuatro números y tres botones; en el móvil empieza a ~640 px y se ve cortada. | Captura 07 | medio | M | Empezar por **La teva pròxima sessió** (día relativo, hora grande, con quién, «Afegir al calendari», «Com arribar» y si se puede cancelar), después «Reservar». Maqueta 14/15. |
| C3 | Cliente | «Sessions restants 5 **de 15 programades**»: el 15 son las sesiones compradas en los bonos activos, no sesiones programadas. | `computeClientKpis` (`totalSessions`); `messages/*.json` `home.kpis.scheduled` | medio | S | «de 15 en els teus bons» / «de 15 en tus bonos» / «of 15 in your passes», o quitar el número (ver propuesta). |
| C4 🟣 | Cliente | **No avisa de que un bono se acaba.** Ana tiene 1 de 5 sesiones de fisioterapia y el Inicio no le dice nada ni le ofrece renovarlo. | Captura 08 | medio | M | Línea en «Els teus bons»: «Et queda 1 sessió · Renovar». **Decisión:** texto comercial y si el botón va a comprar el mismo paquete. |
| C5 | Cliente | Contraste: el texto gris sobre la tarjeta lila de la próxima sesión da 4,17:1 (mínimo 4,5). | axe, ca/es/en, 375 y 1280 | medio | S | Texto secundario de esa tarjeta en `brand-tab` o más oscuro. |
| C6 | Cliente | Las fechas llevan el año: «14 d'oct. del 2026 · 18:00». | Captura 08 | bajo | S | «Demà · 18:00», «dj 15 · 12:00». |
| C7 | Cliente | La próxima sesión sale dos veces: en la tarjeta y como primera fila de «Properes reserves». | Captura 08 | bajo | S | La lista empieza por la siguiente («Després»). |
| C8 | Cliente | La próxima sesión no dice dónde (la dirección ya está en Configuración) ni cómo llegar. | Captura 07 | bajo | S | «Com arribar» con el enlace a Maps (el mismo de los correos). |
| C9 | Cliente | Cliente nuevo sin bonos: cuatro números a cero («0 de 0 programades», «—») antes de «Compra'n un». | Captura 09 | bajo | S | Sin bonos ni reservas, en lugar de los números, una bienvenida con «Comprar bo» o «Sessió de prova». |

### General

| id | área | qué pasa | evidencia | impacto | esfuerzo | propuesta |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | Las tres | **Sin enlace para saltar al contenido**: en escritorio hay 14 tabulaciones por el menú antes de llegar al Inicio (WCAG 2.4.1). | Recorrido con tabulador a 1280 | medio | S | «Saltar al contingut» oculto hasta que recibe el foco, en el marco de las tres áreas. |
| G2 | Las tres | **Patrones distintos para lo mismo.** Avisos: panel azul «Atenció immediata» en admin y profesional; el cliente no tiene ninguno. Números: tarjetas grandes en admin y profesional, franja compacta en el cliente. Los bonos bajos se repiten (número + lista) en dos áreas. | Capturas 01, 04 y 07 | medio | M | Un mismo esquema para las tres: **lo primero que te toca** → **lo que tienes que hacer** (lista con botón) → **números** (compactos) → resto. El cliente también tiene «per fer» (bono que se acaba, bono por pagar, encuesta). |
| G3 | Las tres | Los botones rápidos repiten el menú lateral (3–4 tarjetas grandes en cada área). | Capturas 01, 04 y 07 | bajo | S | Una sola acción principal por área (admin «+ Reserva», profesional «Reservar», cliente «Reservar una sessió»). |
| G4 | Las tres | ✅ Sin scroll horizontal en ninguna de las 72 combinaciones; CLS 0; sin errores de consola; axe sin infracciones en admin y profesional; zonas táctiles: solo 2–4 enlaces de texto pequeños por página. | Barrido | — | — | Nada que hacer. |

### Rendimiento (por lectura del código)

| Área | Consultas por carga (aprox.) | En serie | Comentario |
| --- | --- | --- | --- |
| Admin | ≈ 50 (≈ 31 de «Fora de disponibilitat») | Configuración → 9 en paralelo (cacheada con el marco) | Todo va en paralelo; el coste es de volumen en la base, no de cadena. Ver A6. |
| Profesional | ≈ 15 | Configuración → panel de bonus aparte | `listClients` trae todos sus clientes y bonos sin límite (P4). |
| Cliente | ≈ 10 | Sesión → 7 en paralelo → fotos | La tanda de fotos de los profesionales va después; es menor. |

Tiempo real de servidor: **pendiente de medir en producción** con el modo PRE (Marc).

---

## El Inicio ideal (maquetas)

Las maquetas son HTML estático con los colores y las fuentes de la marca y los datos del estado «cargado». No son código de la app.

### Admin

**Antes:** captura 01 (primera pantalla móvil) y 03 (escritorio entero). **Después:** maquetas 10 (móvil) y 11 (escritorio).

1. **Cabecera** con fecha y dos botones: «+ Reserva» y «+ Cliente».
2. **Por resolver** (contador): pruebas por responder, sesiones sin marcar, bonos y vales por cobrar, clientes sin entrenador, reservas fuera de horario y grupos con cola. Cada fila con **su botón** (Responder, Marcar, Cobrar, Asignar). Si no hay nada: «Todo al día ✓».
3. **Hoy en el centro**, todo el día: hechas, por marcar, ahora y por hacer. El número y la lista cuentan lo mismo.
4. **Cómo va el centro**, en cuatro números compactos y sin cuentas demo: ingresos hasta hoy contra los mismos días del mes anterior, ocupación de la semana (y por profesional), sesiones de la semana y conversión de pruebas.
5. **Para ofrecer renovación**: los 5 primeros clientes y «Ver todos».

### Profesional

**Antes:** captura 04 y 05. **Después:** maquetas 12 y 13.

1. **Cabecera:** «Avui tens 7 sessions · la pròxima a les 18:00».
2. **El teu dia**: hora, cliente y servicio, con lo pasado apagado, «Marcar feta» en las que lo necesitan, la próxima destacada y el grupo con cola del día.
3. **Per fer**: pruebas por responder, sus sesiones sin marcar, historial clínico nuevo y bonos por renovar, cada una con su botón.
4. **Aquesta setmana**: sesiones, ocupación y clientes, en una línea.
5. **Comunidad**: el último anuncio.

Sin la lista de todos los clientes ni la de todos los bonos.

### Cliente

**Antes:** captura 07 y 08. **Después:** maquetas 14 y 15.

1. **La teva pròxima sessió**, grande: «Demà · 17:00», con quién y dónde. Botones «Afegir al calendari» y «Com arribar», y si aún se puede cancelar.
2. **Reservar una sessió**: un solo botón grande.
3. **Els teus bons**: una línea por bono, con barra; si se acaba, «Et queda 1 sessió · Renovar».
4. **Després**: el resto de reservas, con «Cancel·lar» donde se puede.
5. **Novetats del centre**: la última, y «Regala Vindi» al final.

Los cuatro números (sesiones restantes, bonos, reservas y asistencia) salen del Inicio. La asistencia encajaría mejor en «Els meus entrenaments». 🟣

### Decisiones pendientes

| Tema | Pregunta | Hallazgos |
| --- | --- | --- |
| Cuentas demo en los números | ¿Se excluyen siempre del Inicio del admin? | A1 |
| Métrica de ingresos | ¿Mismos días del mes anterior, mes anterior entero o sin porcentaje? (Raul) | A4 |
| Orden de las pantallas | ¿Os vale el esquema «lo primero / per fer / números / resto» de las maquetas? | A2, P2, C2, G2 |
| Sin marcar en el profesional | ¿Se le enseñan en su Inicio? | P3 |
| Renovación desde el Inicio del cliente | Texto y destino del botón | C4 |
| Números del cliente | ¿Se quitan del Inicio? | C2, C3, C9 |

## Plan por fases

1. **Arreglos rápidos (sin decisiones):** P1 (hora en las reservas del profesional), C1 (texto sin traducir), C3 (etiqueta), C5 (contraste), A3 (lista del día completa), A5/P5 (bonos bajos: clientes, tope, sin duplicar), P4 (fuera la lista de 56 clientes), G1 (saltar al contenido), C6/C7.
2. **Con decisión:** A1 (excluir las cuentas demo de los números), A4 (métrica de ingresos), P3 (sin marcar en el profesional), C4 (renovar desde el cliente).
3. **Rediseño de los tres Inicios** según las maquetas (A2, P2, C2, G2, G3) y A6 (consultas de «Fora de disponibilitat»), con la medida en producción antes y después.

## Antes y después (octubre de 2026)

### Fase 1 · arreglos rápidos (en producción, 7aa162c)

P1, C1, C3, C5, A3, A5/P5, P4, G1, C6 y C7. Verificado en producción con la sesión del Client Demo («60 de 75 als teus bons», enlace «Saltar al contingut»).

### Fase 2 y 3 · decisiones de Marc y reordenación (pendiente de push)

| | Antes | Después |
| --- | --- | --- |
| **Admin · orden** | 6 números, 4 accesos, «El que espera resposta», «Avui al centre», 3 tarjetas de agenda y ocupación por profesional | Saludo con «Reserva» y «Client» → **Per resoldre** (un plafón, un botón por fila) → Avui al centre → **Com va el centre** (4 números) → bonos bajos |
| **A1 · cuentas demo** | Los pagos de prueba del Client Demo eran el 88 % de los ingresos de octubre; 4 de los 5 bonos bajos eran suyos; la disponibilidad del Entrenador Demo contaba en la ocupación | Fuera de ingresos, pendientes de cobro, sesiones, ocupación, bonos bajos, sin marcar, fuera de horario, grupos y vales. Fuente única: `demo_profiles` (la de `same_world()`), leída con la clave de servicio solo en el servidor (`lib/data/demo-world.ts`). Sin migración |
| **A4 · ingresos** | Mes en curso contra el mes anterior entero | Del 1 a hoy contra el mismo tramo del mes anterior («vs 1–13 de setembre») |
| **Profesional · orden** | 4 números, 3 accesos, avisos, reservas, bonus, bonos bajos, clientes y todo el muro | Frase del día → **El teu dia** → **Per fer** → Aquesta setmana (3 números) → próximas (sin las de hoy) → bonus → bonos bajos y clientes → último anuncio |
| **P3 · sin marcar** | Solo en Reserves («Cal fer») | En «El teu dia» (las de hoy) y en «Per fer» (otros días, 5 y «I N més»), con **«Marcar feta»**: la misma acción `complete_reservation`, sin tocar permisos |
| **Cliente · orden** | 4 números, 3 accesos, próxima sesión, la misma sesión otra vez en la lista, bonos | **Próxima sesión en grande** (calendario, «Com arribar», cancelar) → **Reservar una sessió** → **Sessions que et queden** → Després (sin repetir la próxima) → comunidad y regalos |
| **C4 · renovar** | Un bono de 1/5 sin ningún aviso | «Renovar» con el umbral de bonos bajos o con el bono acabado (si no tiene otro de ese servicio) → `/client/bonos?paquet=…`, paso 2 con el mismo paquete elegido; precio, pago y confirmación de siempre. No en bonos de suscripción ni de regalo |

Verificación (modo simulación, Chromium a 375/390/1280 y WebKit a 390/1280, estados vacío, normal y cargado): 45 páginas en 200, sin errores de página, sin scroll horizontal y con CLS 0. «Renovar» probado en ca/es/en: abre el paso 2 con `serviceId` igual al del bono. «Marcar feta» probado: la sesión sale de «Per fer». Checks y build en verde.

Altura de la página en el móvil (375 px, estado cargado, en pantallas de 812 px):

| Área | Antes | Después |
| --- | --- | --- |
| Admin | 4,2 | 2,7 |
| Profesional | 3,7 | 3,9 (sale «El teu dia» y «Per fer» con botones) |
| Cliente | 3,3 | 2,9 |

Lo que importa no es la altura total sino qué se ve primero: en las tres áreas, lo primero de la pantalla es ahora el trabajo de hoy, no los números.

## Capturas

| Fichero | Qué muestra |
| --- | --- |
| [01-admin-390-primera-pantalla.jpg](auditoria-inici-capturas/01-admin-390-primera-pantalla.jpg) | Admin, móvil: seis números y botones; los avisos no se ven (A2) |
| [02-admin-390-carregat-sencer.jpg](auditoria-inici-capturas/02-admin-390-carregat-sencer.jpg) | Admin cargado, página entera en el móvil (A2, A5) |
| [03-admin-1280-carregat-sencer.jpg](auditoria-inici-capturas/03-admin-1280-carregat-sencer.jpg) | Admin cargado en escritorio: «10 avui» y 8 en la lista (A3), bonos sin tope (A5) |
| [04-professional-390-primera-pantalla.jpg](auditoria-inici-capturas/04-professional-390-primera-pantalla.jpg) | Profesional, móvil: su día no se ve (P2, P6) |
| [05-professional-1280-carregat-sencer.jpg](auditoria-inici-capturas/05-professional-1280-carregat-sencer.jpg) | Profesional cargado: reservas sin hora (P1), 56 clientes (P4), 18 bonos (P5) |
| [06-professional-390-buit.jpg](auditoria-inici-capturas/06-professional-390-buit.jpg) | Profesional vacío: bonos bajos dos veces, cabecera partida (P9) |
| [07-client-390-primera-pantalla.jpg](auditoria-inici-capturas/07-client-390-primera-pantalla.jpg) | Cliente, móvil: la próxima sesión, cortada abajo (C2) |
| [08-client-1280-carregat-sencer.jpg](auditoria-inici-capturas/08-client-1280-carregat-sencer.jpg) | Cliente cargado: próxima sesión repetida (C7), bono de 1/5 sin aviso (C4) |
| [09-client-390-buit.jpg](auditoria-inici-capturas/09-client-390-buit.jpg) | Cliente nuevo: cuatro ceros antes de la acción (C9) |
| [10-maqueta-admin-390.jpg](auditoria-inici-capturas/10-maqueta-admin-390.jpg) · [11 escritorio](auditoria-inici-capturas/11-maqueta-admin-1280.jpg) | Maqueta del Inicio ideal del admin |
| [12-maqueta-professional-390.jpg](auditoria-inici-capturas/12-maqueta-professional-390.jpg) · [13 escritorio](auditoria-inici-capturas/13-maqueta-professional-1280.jpg) | Maqueta del profesional |
| [14-maqueta-client-390.jpg](auditoria-inici-capturas/14-maqueta-client-390.jpg) · [15 escritorio](auditoria-inici-capturas/15-maqueta-client-1280.jpg) | Maqueta del cliente |
| [16](auditoria-inici-capturas/16-abans-despres-admin-375.jpg) · [17](auditoria-inici-capturas/17-abans-despres-admin-1280.jpg) | Admin, antes y después, 375 y 1280 |
| [18](auditoria-inici-capturas/18-abans-despres-trainer-375.jpg) · [19](auditoria-inici-capturas/19-abans-despres-trainer-1280.jpg) | Profesional, antes y después, 375 y 1280 |
| [20](auditoria-inici-capturas/20-abans-despres-client-375.jpg) · [21](auditoria-inici-capturas/21-abans-despres-client-1280.jpg) | Cliente, antes y después, 375 y 1280 |
