import { CENTER_TZ } from "@/lib/config";

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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
  );
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
 * Avui (YYYY-MM-DD) segons el rellotge del centre.
 *
 * No és `new Date().toISOString().slice(0,10)`: això dona el dia UTC, que entre
 * mitjanit i les 2 de la matinada d'aquí encara és el dia anterior.
 */
export function centerToday(): string {
  return centerDateStr(new Date());
}

/** Desfasament (ms) entre UTC i l'hora del centre en un instant donat. */
function centerOffsetMs(at: Date): number {
  const asUTC = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  const asCenter = new Date(at.toLocaleString("en-US", { timeZone: CENTER_TZ }));
  return asCenter.getTime() - asUTC.getTime();
}

/**
 * Converteix una hora de rellotge del centre ("2026-08-01", "07:00") en
 * l'instant absolut correcte.
 */
export function centerLocalToInstant(dateStr: string, hhmm: string): Date {
  const naive = Date.parse(`${dateStr}T${hhmm}:00Z`);
  if (Number.isNaN(naive)) throw new Error("Data no vàlida.");
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
