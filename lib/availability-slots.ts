/**
 * Lógica pura de disponibilidad (sin acceso a BD), compartida entre el servidor
 * (el servidor) y el calendario del cliente (que navega por semanas en el
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

/**
 * Día de la semana en la convención del negocio (lunes = 0), leyendo la fecha
 * con los getters LOCALES.
 *
 * Pensada para el navegador, donde la hora local es la que ve el usuario. En el
 * servidor NO se debe usar: el proceso corre en UTC y una fecha del centro no
 * se lee con getters locales. Ahí se usan las variantes `…On`, que reciben el
 * día y el día de la semana ya resueltos (ver centerWeekday/centerDateStr).
 */
export function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Día de la semana (lunes = 0) de un día de calendario "YYYY-MM-DD". */
export function weekdayOfDay(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Fecha en formato YYYY-MM-DD leída con los getters LOCALES.
 *
 * Misma advertencia que weekdayOf: es la variante del navegador.
 */
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
  return availableHoursOn(rules, localDateStr(date), weekdayOf(date));
}

/**
 * Núcleo sin `Date`: recibe el día y el día de la semana ya resueltos, así que
 * no puede equivocarse de zona horaria. Es la que usa el servidor.
 */
export function availableHoursOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
): number[] {
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
  return isHourAvailableOn(rules, localDateStr(date), weekdayOf(date), h);
}

/** Núcleo sin `Date` de isHourAvailable. */
export function isHourAvailableOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
  h: number,
): boolean {
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
  return isServiceAvailableOn(
    rules,
    localDateStr(date),
    weekdayOf(date),
    h,
    service,
  );
}

/** Núcleo sin `Date` de isServiceAvailable. La que usa el servidor. */
export function isServiceAvailableOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
  h: number,
  service: ServiceType,
): boolean {
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

/**
 * Servicios que un profesional ofrece en (fecha, hora) según sus reglas.
 *
 * Variante de navegador (lee la fecha con getters locales), como el resto de
 * helpers con `Date` de este módulo.
 */
export function offeredServices(
  rules: TrainerRuleLite[],
  blocks: TrainerBlockLite[],
  trainerId: string,
  date: Date,
  h: number,
): Set<ServiceType> {
  // Un bloqueig temporal tapa la regla setmanal: la franja deixa de ser
  // reservable encara que hi hagi horari definit.
  if (isHourBlocked(blocksOf(blocks, trainerId), date, h))
    return new Set<ServiceType>();
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  const out = new Set<ServiceType>();
  for (const r of rules) {
    if (r.trainerId !== trainerId) continue;
    if (r.weekday !== wd) continue;
    if (day < r.validFrom) continue;
    if (r.validUntil && day > r.validUntil) continue;
    if (h < r.startHour || h >= r.endHour) continue;
    for (const s of r.serviceTypes) out.add(s);
  }
  return out;
}
