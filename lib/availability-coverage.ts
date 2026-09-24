import {
  isServiceAvailableOn,
  isRangeBlocked,
  type AvailabilityRuleLite,
  type AvailabilityBlockLite,
} from "@/lib/availability-slots";
import { centerDateStr, centerSlot, centerWeekday } from "@/lib/center-time";
import type { ServiceType } from "@/types/database";

/**
 * ¿Una sessió concreta està COBERTA per la disponibilitat d'un professional?
 *
 * És la pregunta única que es fan tots els camins que han de saber si una
 * reserva té on caure: reservar (`assertWithinAvailability`), promocionar algú
 * de la llista d'espera, allargar una sèrie i trobar les reserves que un
 * tancament de disponibilitat deixa ORFES. Abans cadascun se la feia a la seva
 * manera, i no deien el mateix: reservar mirava el bloqueig només a l'instant
 * d'inici, i la llista d'espera no ho mirava de cap manera.
 *
 * Coberta vol dir les dues coses alhora:
 *
 *   1. Alguna regla vigent aquell dia ofereix aquest servei i hi cap la sessió
 *      SENCERA (`isServiceAvailableOn`). Si una altra regla segueix cobrint la
 *      franja, la sessió està coberta encara que se n'hagi esborrat una.
 *   2. Cap bloqueig no la toca, per SOLAPAMENT (`isRangeBlocked`): una sessió de
 *      12:00 a 13:00 la tapa un bloqueig que comenci a les 12:30.
 *
 * Pura i sense rellotge: el dia, el dia de la setmana i la franja es llegeixen
 * en hora del CENTRE a partir de l'instant, que és el que permet calcular-la
 * igual al servidor (UTC) i en proves.
 */
export function isSessionCovered(
  rules: AvailabilityRuleLite[],
  blocks: AvailabilityBlockLite[],
  startIso: string,
  durationMinutes: number,
  serviceType: ServiceType,
): boolean {
  const start = new Date(startIso);
  if (
    !isServiceAvailableOn(
      rules,
      centerDateStr(start),
      centerWeekday(start),
      centerSlot(start),
      serviceType,
      durationMinutes,
    )
  )
    return false;
  const startMs = start.getTime();
  return !isRangeBlocked(blocks, startMs, startMs + durationMinutes * 60_000);
}
