/**
 * L'aritmètica dels cicles d'una subscripció. Sense servidor ni base de dades:
 * càlcul pur sobre cadenes "YYYY-MM-DD", per poder-lo raonar (i provar) sense
 * muntar res. Mateix criteri que `lib/booking-series-core.ts`.
 *
 * Totes les dates d'aquest mòdul són DIES DEL CENTRE, no instants. Qui les
 * calcula ha de partir de `centerToday()`: aquí no es llegeix cap rellotge, a
 * posta, perquè una funció que sap quin dia és avui no es pot provar.
 */

/** Últim dia del mes (any i mes 1–12). */
function lastDayOf(year: number, month: number): number {
  // Dia 0 del mes següent = últim dia d'aquest. El mateix truc que ja fa
  // `expiryForNewBono`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function fmt(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "2026-01-31" → [2026, 1, 31]. */
function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    throw new Error(`Data no vàlida: ${iso}`);
  return [y, m, d];
}

/**
 * Suma mesos a una data retallant el dia al final del mes de destí.
 *
 * El 31 de gener més un mes és el 28 de febrer, mai l'1 de març: qui compra el
 * dia 31 no espera que el seu mes s'acabi un dia abans que el del veí.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12 + 1;
  return fmt(ty, tm, Math.min(d, lastDayOf(ty, tm)));
}

/**
 * El dia del mes en què es renovarà sempre aquesta subscripció.
 *
 * Surt del dia de l'alta i es desa un sol cop. NO es torna a deduir del cicle
 * en curs, i aquest és tot el motiu que la columna existeixi — veure
 * `renewalAfter`.
 */
export function anchorDayFor(startedOn: string): number {
  return parts(startedOn)[2];
}

/**
 * Quan comença el cicle següent al que va començar `cycleStart`.
 *
 * AQUÍ HI HA LA TRAMPA, i és per això que cal l'`anchorDay` i no n'hi ha prou
 * amb "suma-li un mes al cicle actual".
 *
 * Qui es dona d'alta el 31 de gener té el cicle següent el 28 de febrer, que és
 * el que toca. Però si el de març es calculés sumant un mes al 28 de febrer,
 * sortiria el 28 de març, i el d'abril el 28 d'abril: el retall d'un sol mes
 * curt es quedaria enganxat per sempre i la persona hauria perdut tres dies de
 * subscripció cada any sense que ningú se n'adonés.
 *
 * Amb l'àncora, cada renovació es calcula des del dia original: febrer retalla,
 * març torna al 31. El retall no s'acumula mai.
 */
export function renewalAfter(cycleStart: string, anchorDay: number): string {
  const [y, m] = parts(cycleStart);
  const total = m; // mes actual (1-based) + 1, menys 1 per indexar des de 0
  const ty = y + Math.floor(total / 12);
  const tm = (total % 12) + 1;
  return fmt(ty, tm, Math.min(anchorDay, lastDayOf(ty, tm)));
}

/** El dia anterior a `iso`. */
export function previousDay(iso: string): string {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - 1);
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Quan caduca el bo d'un cicle.
 *
 * L'últim dia ABANS de la renovació següent, no el dia de la renovació: així el
 * bo del mes vell i el del mes nou no conviuen mai. `isBonoExpired` compara amb
 * `<`, o sigui que un bo amb data d'avui encara serveix avui; posant-hi el dia
 * de la renovació, el client tindria les sessions dels dos mesos durant una
 * jornada sencera.
 *
 * Recorda què vol dir "fer servir" una sessió: RESERVAR-LA, no assistir-hi.
 * Reservar ja descompta, així que amb el bo d'aquest mes es poden agafar
 * franges del mes que ve. El que caduca és el que no s'ha arribat a reservar.
 */
export function cycleExpiry(cycleStart: string, anchorDay: number): string {
  return previousDay(renewalAfter(cycleStart, anchorDay));
}

/**
 * Suma dies a una data. Sense retallar res: aquí no hi ha mesos, hi ha dies.
 *
 * És el que fa falta per reprendre una subscripció congelada, i deliberadament
 * NO passa per `addMonthsClamped`: una pausa de 20 dies retarda la renovació 20
 * dies exactes, no "un mes escàs".
 */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Dies sencers entre dues dates (`to − from`). Negatiu si `to` és anterior.
 *
 * Es compta sobre dies del CENTRE, no sobre instants: una pausa del dia 6 al 26
 * són 20 dies encara que s'hagi congelat a les 23:50 i reprès a les 00:10, i
 * comptar-ho en hores donaria 19 o 21 segons l'estona del dia.
 */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}
