/**
 * Lógica pura de disponibilidad (sin acceso a BD), compartida entre el servidor
 * y el calendario del cliente (que navega por semanas en el navegador).
 *
 * LA UNITAT ÉS EL SLOT DE MITJA HORA, NO L'HORA
 *
 * Fins ara tot això comptava en hores senceres, i hi havia una raó que semblava
 * bona: la rejilla de l'agenda era d'una hora i les sessions duraven una hora,
 * així que "hora" volia dir les dues coses alhora i ningú havia de triar. El dia
 * que una sessió pugui començar a les 9:30, les dues coses es separen.
 *
 * Un slot és un índex de mitja hora des de mitjanit, 0..47: les 9:00 són el 18 i
 * les 9:30 el 19. És un enter, com abans, i per tant totes les comparacions
 * segueixen sent aritmètica d'enters.
 *
 * AQUEST CANVI NO MOU CAP COMPORTAMENT. Mentre les regles caiguin en punt i les
 * sessions durin 60 minuts, cada pregunta d'abans té exactament la mateixa
 * resposta (hi ha proves que ho comproven cas per cas). El que canvia és que ara
 * hi ha VOCABULARI per a les preguntes que abans no es podien ni formular.
 *
 * DUES COSES QUE ABANS ES DEIEN IGUAL I NO SÓN LA MATEIXA
 *
 *   · `availableSlotsOn` — quines mitges hores COBREIX l'horari declarat. És
 *     capacitat: el que es mesura per dir "aquest professional té la setmana
 *     plena al 60%".
 *   · `bookableStartSlotsOn` — on pot COMENÇAR una sessió. Depèn de quant dura:
 *     amb una regla de 9:00 a 13:00, una sessió d'una hora no pot començar a les
 *     12:30 perquè acabaria fora.
 *
 * Amb rejilla i sessió d'una hora les dues llistes tenien la mateixa mida, i per
 * això es van escriure com una sola funció. No ho són.
 */

import type { ServiceType } from "@/types/database";

/** Durada d'un slot en minuts. La unitat de la graella de l'agenda. */
export const SLOT_MINUTES = 30;

/** Quants slots té un dia. */
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

/**
 * Slot que conté una hora de rellotge ("09:30", "09:30:00" o "09:45").
 *
 * Trunca cap avall: les 9:45 cauen al slot de les 9:30. Per llegir els extrems
 * d'una regla NO es fa servir aquesta directament sinó `startSlotOf` i
 * `endSlotOf`, que arrodoneixen cap a dins (veure allà el perquè).
 */
export function slotOf(time: string): number {
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(3, 5), 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * (60 / SLOT_MINUTES) + Math.floor(m / SLOT_MINUTES);
}

/**
 * Slot d'INICI d'una regla, arrodonint cap amunt.
 *
 * Una regla que comencés a les 9:15 no autoritza a reservar a les 9:00. Com que
 * la columna de la base és `time` i admet qualsevol minut —encara que el
 * formulari no— arrodonir cap avall obriria franges que el professional no ha
 * declarat. Cap a dins mai ofereix de més.
 */
export function startSlotOf(time: string): number {
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(3, 5), 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * (60 / SLOT_MINUTES) + Math.ceil(m / SLOT_MINUTES);
}

/** Slot de FI (exclòs) d'una regla, arrodonint cap avall. Mateix criteri. */
export function endSlotOf(time: string): number {
  return slotOf(time);
}

/** Slot en què cau una hora sencera. Les 9 → 18. */
export function hourToSlot(hour: number): number {
  return hour * (60 / SLOT_MINUTES);
}

/** Hora sencera que conté un slot. El 19 (9:30) → 9. */
export function slotToHour(slot: number): number {
  return Math.floor(slot / (60 / SLOT_MINUTES));
}

/** "HH:MM" d'un slot. El 19 → "09:30". */
export function slotToHHMM(slot: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const total = slot * SLOT_MINUTES;
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`;
}

/**
 * Quants slots ocupa una sessió. Es puja al slot sencer: una sessió de 45
 * minuts n'ocupa dos, perquè deixa mig slot inservible.
 */
export function slotsFor(durationMinutes: number): number {
  return Math.ceil(durationMinutes / SLOT_MINUTES);
}

export type AvailabilityRuleLite = {
  weekday: number; // 0 = dilluns … 6 = diumenge
  startSlot: number; // slot de inicio (0..47)
  endSlot: number; // slot de fin (exclusivo)
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

/**
 * ¿Dos franjas semiabiertas [inicio, fin) se solapan?
 *
 * És la condició de sempre entre dos intervals, i la mateixa que fa servir la
 * constraint de la 0082 amb `tstzrange(..., '[)')`. Semioberta vol dir que una
 * sessió de 9:00 a 10:00 i una de 10:00 a 11:00 NO es trepitgen: són seguides.
 *
 * Tots quatre valors en mil·lisegons.
 */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Final (exclòs) d'una sessió, en ISO.
 *
 * El bessó en JavaScript del que fa el trigger `trg_reservations_ends_at` de la
 * 0082 a la base. Es fa servir al mode simulació —que no té triggers— i per
 * construir les consultes de solapament.
 */
export function sessionEndIso(startIso: string, durationMinutes: number): string {
  return new Date(
    new Date(startIso).getTime() + durationMinutes * 60_000,
  ).toISOString();
}

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
 * ¿La sessió que començaria al slot `slot` del dia `date` solapa algun bloqueig?
 *
 * El que es compara és el rang de la SESSIÓ, no el del slot. Abans això no es
 * distingia —la funció es deia `isHourBlocked` i mirava [h, h+1)— perquè slot i
 * sessió duraven el mateix. Ara no: una sessió d'una hora que comenci a les 9:00
 * la tapa un bloqueig de 9:30 a 10:00, encara que el slot de les 9:00 acabi
 * abans que el bloqueig comenci.
 *
 * `date`+`slot` s'interpreten a la zona del qui crida (al navegador, la del
 * centre).
 */
export function isSlotBlocked(
  blocks: AvailabilityBlockLite[],
  date: Date,
  slot: number,
  durationMinutes: number,
): boolean {
  const start = new Date(date);
  start.setHours(0, slot * SLOT_MINUTES, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return blocks.some((b) =>
    rangesOverlap(
      start.getTime(),
      end.getTime(),
      new Date(b.startAt).getTime(),
      new Date(b.endAt).getTime(),
    ),
  );
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

/** ¿La regla `r` rige el día `day` (día de la semana `wd`)? */
function ruleApplies(
  r: AvailabilityRuleLite,
  day: string,
  wd: number,
): boolean {
  return (
    r.weekday === wd &&
    day >= r.validFrom &&
    (!r.validUntil || day <= r.validUntil)
  );
}

/**
 * Slots que COBREIX l'horari declarat en una data. Capacitat, no inicis.
 *
 * Traducció directa de l'antiga `availableHoursOn`: allà es comptaven hores
 * senceres cobertes per una regla, aquí mitges hores. El tauler d'ocupació la fa
 * servir per al denominador, i la proporció no es mou perquè el numerador també
 * passa a comptar-se en slots coberts.
 */
export function availableSlotsOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
): number[] {
  const slots = new Set<number>();
  for (const r of rules) {
    if (!ruleApplies(r, day, wd)) continue;
    for (let s = r.startSlot; s < r.endSlot; s++) slots.add(s);
  }
  return [...slots].sort((a, b) => a - b);
}

/**
 * Slots on pot COMENÇAR una sessió de `durationMinutes`.
 *
 * La sessió ha de cabre sencera dins d'UNA regla. Dues regles consecutives
 * (9:00–11:00 i 11:00–13:00) no es cusen per deixar començar a les 10:30: seria
 * un comportament difícil d'explicar i d'endevinar des de la pantalla, i el
 * professional que parteix el matí en dos trams normalment ho fa per alguna raó.
 */
export function bookableStartSlotsOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
  durationMinutes: number,
): number[] {
  const need = slotsFor(durationMinutes);
  const slots = new Set<number>();
  for (const r of rules) {
    if (!ruleApplies(r, day, wd)) continue;
    for (let s = r.startSlot; s + need <= r.endSlot; s++) slots.add(s);
  }
  return [...slots].sort((a, b) => a - b);
}

/** ¿Cap una sessió que empieza en `slot` dentro de la regla `r`? */
function fitsInRule(
  r: AvailabilityRuleLite,
  slot: number,
  durationMinutes: number,
): boolean {
  return slot >= r.startSlot && slot + slotsFor(durationMinutes) <= r.endSlot;
}

/** ¿Puede empezar en `slot` de `date` una sesión de `durationMinutes`? */
export function isSlotAvailable(
  rules: AvailabilityRuleLite[],
  date: Date,
  slot: number,
  durationMinutes: number,
): boolean {
  return isSlotAvailableOn(
    rules,
    localDateStr(date),
    weekdayOf(date),
    slot,
    durationMinutes,
  );
}

/** Núcleo sin `Date` de isSlotAvailable. */
export function isSlotAvailableOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
  slot: number,
  durationMinutes: number,
): boolean {
  return rules.some(
    (r) => ruleApplies(r, day, wd) && fitsInRule(r, slot, durationMinutes),
  );
}

/**
 * Núcleo sin `Date`: ¿cabe en `slot` una sesión de `service`? (además del
 * horario, la regla debe ofrecer ese servicio). La que usa el servidor.
 */
export function isServiceAvailableOn(
  rules: AvailabilityRuleLite[],
  day: string,
  wd: number,
  slot: number,
  service: ServiceType,
  durationMinutes: number,
): boolean {
  return rules.some(
    (r) =>
      ruleApplies(r, day, wd) &&
      fitsInRule(r, slot, durationMinutes) &&
      r.serviceTypes.includes(service),
  );
}

/**
 * Servicios que un profesional ofrece en (fecha, slot) según sus reglas.
 *
 * Variante de navegador (lee la fecha con getters locales), como el resto de
 * helpers con `Date` de este módulo.
 */
export function offeredServices(
  rules: TrainerRuleLite[],
  blocks: TrainerBlockLite[],
  trainerId: string,
  date: Date,
  slot: number,
  durationMinutes: number,
): Set<ServiceType> {
  // Un bloqueig temporal tapa la regla setmanal: la franja deixa de ser
  // reservable encara que hi hagi horari definit.
  if (isSlotBlocked(blocksOf(blocks, trainerId), date, slot, durationMinutes))
    return new Set<ServiceType>();
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  const out = new Set<ServiceType>();
  for (const r of rules) {
    if (r.trainerId !== trainerId) continue;
    if (!ruleApplies(r, day, wd)) continue;
    if (!fitsInRule(r, slot, durationMinutes)) continue;
    for (const s of r.serviceTypes) out.add(s);
  }
  return out;
}
