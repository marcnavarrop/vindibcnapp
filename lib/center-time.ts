import { CENTER_TZ } from "@/lib/config";
import { slotOf } from "@/lib/availability-slots";

/**
 * Conversions entre l'hora de rellotge del centre i instants absoluts.
 *
 * El servidor corre en UTC però el negoci pensa en hora local del centre: les
 * regles de disponibilitat són "de 9 a 14" i el dia natural va de mitjanit a
 * mitjanit d'aquí. Sense aquestes conversions tot es desplaça una o dues hores
 * segons l'horari d'estiu.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Retorna un Date "trampa" en què els mètodes locals (getHours, getDate…)
 * donen els valors de la zona del centre, no els del servidor. Serveix per
 * comparar amb regles expressades en hores locals.
 *
 * OJO: el valor absolut d'aquest Date NO és l'instant real. Per comparar amb
 * timestamps reals (bloquejos, reserves), fes servir centerLocalToInstant.
 */
export function toCenterLocal(utcDate: Date): Date {
  const parts = centerPartsFormat().formatToParts(utcDate);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
  );
}

/*
 * ELS FORMATADORS ES CREEN UN COP
 *
 * Crear un `Intl.DateTimeFormat` (o cridar `toLocaleString` amb `timeZone`,
 * que en crea un per dins a cada crida) costa desenes de microsegons. La tira
 * de 21 dies de /client/reservas en feia ~2.300 en hidratar-se: 80 dels 90 ms
 * de la tasca llarga (perfil de CPU, octubre 2026). Un formatador no guarda
 * cap estat entre crides, així que es pot reaprofitar sense canviar res del
 * que torna. Es creen en el primer ús i no en carregar el mòdul, perquè
 * importar-lo no costi res a qui no el fa servir.
 */
let partsFormat: Intl.DateTimeFormat | null = null;
/** El de `toCenterLocal`: les MATEIXES opcions que hi havia, per no moure cap resultat. */
function centerPartsFormat(): Intl.DateTimeFormat {
  return (partsFormat ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }));
}

let offsetFormat: Intl.DateTimeFormat | null = null;
/** El de `centerOffsetMs`. `h23`: la mitjanit és 00, mai 24. */
function centerOffsetFormat(): Intl.DateTimeFormat {
  return (offsetFormat ??= new Intl.DateTimeFormat("en-US", {
    timeZone: CENTER_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }));
}

/** Data del centre en format YYYY-MM-DD per a un instant donat. */
export function centerDateStr(utcDate: Date): string {
  const d = toCenterLocal(utcDate);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Hora (0-23) del centre per a un instant donat. */
export function centerHour(utcDate: Date): number {
  return toCenterLocal(utcDate).getUTCHours();
}

/**
 * Slot de mitja hora (0..47) del centre per a un instant donat.
 *
 * Germà de `centerHour`, per al codi que ja compta en slots. Es queda aquí i no
 * a `availability-slots.ts` perquè el que sap de la zona horària del centre és
 * aquest mòdul; allà la lògica és pura i no toca cap rellotge.
 */
export function centerSlot(utcDate: Date): number {
  const d = toCenterLocal(utcDate);
  // Passa per `slotOf` en comptes de repetir l'aritmètica: la conversió d'una
  // hora de rellotge a slot viu en un sol lloc, i si la graella deixés de ser
  // de mitja hora aquí no hi hauria res a tocar.
  return slotOf(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`);
}

/** Dia de la setmana al centre en la convenció del negoci (dilluns = 0). */
export function centerWeekday(utcDate: Date): number {
  return (toCenterLocal(utcDate).getUTCDay() + 6) % 7;
}

/**
 * Avui (YYYY-MM-DD) segons el rellotge del centre.
 *
 * No és `new Date().toISOString().slice(0,10)`: això dona el dia UTC, que entre
 * mitjanit i les 2 de la matinada d'aquí encara és el dia anterior.
 */
export function centerToday(): string {
  return centerDateStr(new Date());
}

/**
 * Desfasament (ms) entre UTC i l'hora del centre en un instant donat.
 *
 * Abans: dos `toLocaleString` (UTC i centre) llegits amb `new Date(text)`, que
 * treu els mil·lisegons. Ara: l'hora de rellotge del centre en trossos, i
 * l'instant també sense mil·lisegons, perquè el resultat sigui el mateix al
 * mil·lisegon. `npm run tz:check` ho compara minut a minut.
 */
function centerOffsetMs(at: Date): number {
  const parts = centerOffsetFormat().formatToParts(at);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/*
 * EL DESFASAMENT, UN COP PER DIA
 *
 * `centerLocalToInstant` el demana en dos instants per hora, i la tira de
 * Reserves en converteix centenars del mateix dia. El desfasament només canvia
 * en un canvi d'hora, i entre dos canvis hi ha mesos: si és el mateix tres
 * hores abans de la mitjanit (hora UTC) d'aquell dia i tres hores després del
 * final del dia, entremig no n'hi ha cap, i tots els instants que el càlcul
 * pugui consultar (sempre a menys de tres hores de l'hora escrita) en tenen
 * aquest mateix. Llavors la resposta és la mateixa que la del càlcul complet.
 * Els dies amb canvi d'hora es queden amb el càlcul complet (`null`).
 */
const DAY_MS = 86_400_000;
const MARGIN_MS = 3 * 3_600_000;
const dayOffsetCache = new Map<string, number | null>();
function steadyDayOffset(dateStr: string, dayNaive: number): number | null {
  const hit = dayOffsetCache.get(dateStr);
  if (hit !== undefined) return hit;
  const a = centerOffsetMs(new Date(dayNaive - MARGIN_MS));
  const b = centerOffsetMs(new Date(dayNaive + DAY_MS + MARGIN_MS));
  const v = a === b ? a : null;
  // Sostre: la memòria d'un procés que corre mesos no ha de créixer sense fi.
  if (dayOffsetCache.size > 2000) dayOffsetCache.clear();
  dayOffsetCache.set(dateStr, v);
  return v;
}

/**
 * Converteix una hora de rellotge del centre ("2026-08-01", "07:00") en
 * l'instant absolut correcte.
 */
export function centerLocalToInstant(dateStr: string, hhmm: string): Date {
  const naive = Date.parse(`${dateStr}T${hhmm}:00Z`);
  if (Number.isNaN(naive)) throw new Error("Data no vàlida.");
  // Només per a una data i una hora ben escrites: el dia ha de ser el de la
  // mateixa data a les 00:00 i l'hora ha de caure dins d'aquest dia.
  const dayNaive = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isNaN(dayNaive) && naive >= dayNaive && naive < dayNaive + DAY_MS) {
    const steady = steadyDayOffset(dateStr, dayNaive);
    if (steady !== null) return new Date(naive - steady);
  }
  const offset = centerOffsetMs(new Date(naive));
  const first = new Date(naive - offset);
  // Segona passada: prop d'un canvi d'hora, l'offset del resultat pot diferir.
  const refined = centerOffsetMs(first);
  return refined === offset ? first : new Date(naive - refined);
}

/**
 * Converteix el valor d'un `<input type="datetime-local">` en l'instant real.
 *
 * El valor d'aquests inputs ("2026-08-02T23:30") no porta zona horària, i
 * `new Date(...)` el llegiria en la zona del PROCÉS — que a Vercel és UTC. Qui
 * escriu les 23:30 al panell vol dir les 23:30 del centre, no les 23:30 UTC:
 * sense aquesta conversió la reserva es desa una o dues hores desplaçada.
 *
 * Retorna null si el valor no és una data vàlida, perquè qui crida pugui
 * respondre amb el seu propi missatge d'error.
 */
export function datetimeLocalToInstant(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  if (!m) return null;
  try {
    const at = centerLocalToInstant(m[1], m[2]);
    return Number.isNaN(at.getTime()) ? null : at;
  } catch {
    return null;
  }
}

// ─── Dies i setmanes del centre, com a text ─────────────────────────────────
//
// Les finestres de les consultes (la setmana de l'agenda, "avui", els trenta
// dies de la llista) es pensen en dies del CENTRE i es passen a instants només
// en el moment de preguntar a la base. Treballar amb "YYYY-MM-DD" fins aquí
// evita que un Date amb la zona del procés s'hi coli pel mig.

/** Suma `n` dies a una data "YYYY-MM-DD". Aritmètica de calendari, sense zona. */
export function addDaysStr(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** El dilluns de la setmana que conté `day` (per defecte, avui al centre). */
export function centerWeekStart(day: string = centerToday()): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysStr(day, -weekday);
}

/** La mitjanit del centre d'un dia, com a instant real. */
export function centerDayStart(day: string): Date {
  return centerLocalToInstant(day, "00:00");
}

/**
 * Llegeix un paràmetre `?setmana=` i en torna el dilluns.
 *
 * Qualsevol dia serveix (es porta al dilluns de la seva setmana), i el que no
 * és una data de debò torna la setmana d'avui: un enllaç mal copiat ha d'obrir
 * l'agenda, no una pàgina d'error.
 */
export function parseWeekParam(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return centerWeekStart();
  const d = new Date(`${v}T00:00:00Z`);
  // "2026-02-31" el Date el passa al març: si no torna igual, no era una data.
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v)
    return centerWeekStart();
  return centerWeekStart(v);
}
