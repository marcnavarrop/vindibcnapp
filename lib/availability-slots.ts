/**
 * Lógica pura de disponibilidad (sin acceso a BD), compartida entre el servidor
 * (getAvailableSlots) y el calendario del cliente (que navega por semanas en el
 * navegador). Las sesiones son de 1 hora, alineadas con el calendario actual.
 */

import type { ServiceType } from "@/types/database";

export type AvailabilityRuleLite = {
  weekday: number; // 0 = dilluns … 6 = diumenge
  startHour: number; // hora de inicio (entero)
  endHour: number; // hora de fin (exclusiva)
  validFrom: string; // YYYY-MM-DD
  validUntil: string | null; // YYYY-MM-DD o null (sin fin)
  serviceTypes: ServiceType[]; // servicios ofrecidos en esa franja
};

/** Regla lite con el profesional dueño (para el calendario global del cliente). */
export type TrainerRuleLite = AvailabilityRuleLite & { trainerId: string };

/**
 * Bloqueo temporal (vacaciones, baja, tarde puntual). Se superpone a las reglas
 * semanales: una franja solo es reservable si hay regla Y no cae en un bloqueo.
 *
 * A diferencia de las reglas —que son horas locales del centro— un bloqueo es
 * un rango de INSTANTES absolutos, así que se compara como tal y no necesita
 * conversión de zona horaria.
 */
export type AvailabilityBlockLite = {
  /** ISO 8601 */
  startAt: string;
  /** ISO 8601, exclusivo */
  endAt: string;
};

/** Bloqueo con el profesional dueño (para el calendario global). */
export type TrainerBlockLite = AvailabilityBlockLite & { trainerId: string };

/** Horario de apertura del centro, usado para los bloqueos de "día completo". */
export const CENTER_OPEN_HOUR = 7;
export const CENTER_CLOSE_HOUR = 22;

/** ¿El instante `at` cae dentro de algún bloqueo? (inicio incluido, fin excluido) */
export function isInstantBlocked(
  blocks: AvailabilityBlockLite[],
  at: Date,
): boolean {
  const t = at.getTime();
  return blocks.some(
    (b) => t >= new Date(b.startAt).getTime() && t < new Date(b.endAt).getTime(),
  );
}

/**
 * ¿La franja de una hora que empieza a las `h` del día `date` solapa algún
 * bloqueo? `date`+`h` se interpretan en la zona horaria del entorno que llama
 * (en el navegador, la del usuario: la del centro).
 */
export function isHourBlocked(
  blocks: AvailabilityBlockLite[],
  date: Date,
  h: number,
): boolean {
  const slotStart = new Date(date);
  slotStart.setHours(h, 0, 0, 0);
  const slotEnd = new Date(slotStart);
  slotEnd.setHours(h + 1, 0, 0, 0);
  return blocks.some((b) => {
    const bStart = new Date(b.startAt).getTime();
    const bEnd = new Date(b.endAt).getTime();
    // Solapamiento de intervalos semiabiertos.
    return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
  });
}

/** Filtra los bloqueos de un profesional concreto. */
export function blocksOf(
  blocks: TrainerBlockLite[],
  trainerId: string,
): AvailabilityBlockLite[] {
  return blocks.filter((b) => b.trainerId === trainerId);
}

/** Día de la semana de una fecha en la convención del negocio (lunes = 0). */
export function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Fecha local en formato YYYY-MM-DD (sin desfases de zona horaria). */
export function localDateStr(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * Horas (enteras) disponibles para un entrenador en una fecha dada, según sus
 * reglas. Una hora `h` está disponible si existe una regla del mismo día de la
 * semana, vigente esa fecha, con startHour <= h < endHour.
 */
export function availableHoursForDate(
  rules: AvailabilityRuleLite[],
  date: Date,
): number[] {
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  const hours = new Set<number>();
  for (const r of rules) {
    if (r.weekday !== wd) continue;
    if (day < r.validFrom) continue;
    if (r.validUntil && day > r.validUntil) continue;
    for (let h = r.startHour; h < r.endHour; h++) hours.add(h);
  }
  return [...hours].sort((a, b) => a - b);
}

/** ¿La hora `h` de la fecha `date` cae dentro de la disponibilidad? */
export function isHourAvailable(
  rules: AvailabilityRuleLite[],
  date: Date,
  h: number,
): boolean {
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  return rules.some(
    (r) =>
      r.weekday === wd &&
      day >= r.validFrom &&
      (!r.validUntil || day <= r.validUntil) &&
      h >= r.startHour &&
      h < r.endHour,
  );
}

/**
 * ¿La hora `h` de `date` está dentro de la disponibilidad para el servicio
 * `service`? (además del horario, la regla debe ofrecer ese servicio).
 */
export function isServiceAvailable(
  rules: AvailabilityRuleLite[],
  date: Date,
  h: number,
  service: ServiceType,
): boolean {
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  return rules.some(
    (r) =>
      r.weekday === wd &&
      day >= r.validFrom &&
      (!r.validUntil || day <= r.validUntil) &&
      h >= r.startHour &&
      h < r.endHour &&
      r.serviceTypes.includes(service),
  );
}
