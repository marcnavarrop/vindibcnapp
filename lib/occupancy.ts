import { availableSlotsOn, weekdayOfDay, type AvailabilityRuleLite } from "@/lib/availability-slots";

/**
 * L'OCUPACIÓ D'UN PROFESSIONAL, en un sol lloc.
 *
 * La fan servir l'Inici (de l'admin i del professional), la tira de la setmana
 * i el mode «Setmana» de l'agenda. Abans n'hi havia dues de diferents: l'Inici
 * comptava temps reservat i la tira comptava inicis on ja no cabia una sessió
 * nova, i el mateix dia sortia amb xifres diferents a cada pantalla.
 *
 * QUÈ COMPTA
 *
 *   ocupació = mitges hores reservades / mitges hores d'horari sense bloqueig
 *
 *   · El denominador: les mitges hores que cobreix l'horari del professional
 *     aquell dia, menys les que tapa un bloqueig.
 *   · El numerador: d'aquestes, les que cobreix una sessió reservada o feta
 *     (`COUNTS_AS_OCCUPIED`). Una sessió d'una hora en cobreix dues.
 *   · Un grup compta la seva hora SENCERA, tingui 1 o 4 apuntats: el
 *     professional hi és igual. Les places lliures es veuen a la peça del grup.
 *   · Les cancel·lades no compten. Les proves tampoc (com fins ara a l'Inici).
 *   · Tot el dia, també la part que ja ha passat.
 *
 * El dia i el slot van explícits i qui crida diu què és reservat i què és
 * bloquejat: el servidor ho resol en hora del centre i l'agenda, en la del
 * navegador. El càlcul, que és el que ha de coincidir, és aquest.
 */

/** Estats que ocupen temps del professional. */
export const COUNTS_AS_OCCUPIED = (status: string) =>
  status === "booked" || status === "completed";

export type Occupancy = { slots: number; booked: number; pct: number };

export function occupancyOf(
  rules: AvailabilityRuleLite[],
  days: string[],
  isBlocked: (day: string, slot: number) => boolean,
  isBooked: (day: string, slot: number) => boolean,
): Occupancy {
  let slots = 0;
  let booked = 0;
  for (const day of days)
    for (const slot of availableSlotsOn(rules, day, weekdayOfDay(day))) {
      if (isBlocked(day, slot)) continue;
      slots++;
      if (isBooked(day, slot)) booked++;
    }
  return { slots, booked, pct: slots > 0 ? (booked / slots) * 100 : 0 };
}
