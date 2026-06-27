/**
 * Lógica pura de disponibilidad (sin acceso a BD), compartida entre el servidor
 * (getAvailableSlots) y el calendario del cliente (que navega por semanas en el
 * navegador). Las sesiones son de 1 hora, alineadas con el calendario actual.
 */

export type AvailabilityRuleLite = {
  weekday: number; // 0 = dilluns … 6 = diumenge
  startHour: number; // hora de inicio (entero)
  endHour: number; // hora de fin (exclusiva)
  validFrom: string; // YYYY-MM-DD
  validUntil: string | null; // YYYY-MM-DD o null (sin fin)
};

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
