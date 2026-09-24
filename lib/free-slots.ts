import { GROUP_CAPACITY, SESSION_DURATION_MINUTES } from "@/lib/labels";
import {
  localDateStr,
  localSlotOf,
  offeredServices,
  slotsFor,
  SLOT_MINUTES,
  type TrainerBlockLite,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import type { ServiceType } from "@/types/database";

/**
 * QUAN UN FORAT ÉS LLIURE DE DEBÒ.
 *
 * Una sola resposta per a totes les pantalles que ofereixen forats: la capa de
 * disponibilitat de l'agenda de l'equip, el calendari del client i /prova. Abans
 * cadascuna ho calculava a la seva manera, i dues s'equivocaven:
 *
 *   · L'agenda de l'equip només mirava regles i bloquejos, mai les reserves:
 *     en Raul sortia lliure el dijous a les 7:00 tenint-hi la Laura.
 *   · El client mirava l'inici i la mitja hora tapada per darrere, però no una
 *     sessió que comencés a la SEGONA mitja hora: el dissabte a les 10:00 en
 *     Raul sortia lliure amb una sessió a les 10:30.
 *   · /prova ja ho feia bé. La regla d'aquí és la seva, generalitzada.
 *
 * LA REGLA ÉS LA DEL SERVIDOR
 *
 * Un servei es pot reservar en un inici si:
 *   1. el professional l'ofereix en una regla on hi caben els 60 minuts sencers,
 *   2. cap bloqueig toca aquells 60 minuts, i
 *   3. hi ha lloc entre els OCUPANTS: tot el que es trepitja amb aquells 60
 *      minuts (reserves 'booked' i proves actives), amb el mateix criteri que
 *      `slotHasRoom` fa servir en crear la reserva. Un individual necessita zero
 *      ocupants; un grup, cap ocupant que no sigui de grup i menys de
 *      GROUP_CAPACITY.
 *
 * Per això un grup amb plaça surt com a "Grup" i prou: s'hi pot apuntar
 * algú, però no hi cap una sessió individual.
 *
 * El servidor segueix sent l'última paraula (la constraint de la 0082 i el pany
 * de la 0083). Aquí només es promet el que ell acceptarà.
 */

/** El que ocupa part d'una franja. Només cal el servei: decideix si hi ha lloc. */
export type Occupant = { serviceType: ServiceType };

/**
 * On es pregunta qui ocupa una franja.
 *
 * Una funció i no una llista perquè /prova no té les sessions, només els slots
 * ocupats (la pàgina és pública i no publica res més), i l'agenda i el client sí
 * que les tenen. Cadascun construeix la seva consulta; la regla és la mateixa.
 */
export type OccupancyLookup = (
  trainerId: string,
  start: Date,
  durationMinutes: number,
) => Occupant[];

/**
 * Hi ha lloc per a una sessió nova d'aquest servei entre aquests ocupants?
 *
 * És la regla de sempre de `slotHasRoom` (lib/data/reservations.ts), que ara
 * viu aquí perquè la facin servir tant el servidor com les pantalles.
 */
export function hasRoom(occupants: Occupant[], service: ServiceType): boolean {
  if (service === "grupo_reducido")
    return (
      !occupants.some((o) => o.serviceType !== "grupo_reducido") &&
      occupants.length < GROUP_CAPACITY
    );
  return occupants.length === 0;
}

/** Una sessió coneguda, tal com la tenen l'agenda i el client. */
export type KnownSession = {
  trainerId: string | null;
  /** ISO 8601 */
  scheduledAt: string;
  serviceType: ServiceType;
  /** Si no hi és, la durada estàndard. */
  durationMinutes?: number;
};

/**
 * Ocupació a partir de sessions conegudes (reserves 'booked' i proves actives).
 *
 * Qui crida ja ha de passar NOMÉS el que ocupa: ni cancel·lades ni proves
 * caducades. Solapament semiobert [inici, final), com la 0082.
 */
export function occupancyFromSessions(sessions: KnownSession[]): OccupancyLookup {
  const byTrainer = new Map<string, { s: number; e: number; serviceType: ServiceType }[]>();
  for (const x of sessions) {
    if (!x.trainerId) continue;
    const s = new Date(x.scheduledAt).getTime();
    const e = s + (x.durationMinutes ?? SESSION_DURATION_MINUTES) * 60_000;
    const list = byTrainer.get(x.trainerId) ?? [];
    list.push({ s, e, serviceType: x.serviceType });
    byTrainer.set(x.trainerId, list);
  }
  return (trainerId, start, durationMinutes) => {
    const a = start.getTime();
    const b = a + durationMinutes * 60_000;
    return (byTrainer.get(trainerId) ?? [])
      .filter((x) => x.s < b && a < x.e)
      .map((x) => ({ serviceType: x.serviceType }));
  };
}

/**
 * Ocupació a partir de claus de slot ocupat ("trainerId|YYYY-MM-DD|slot"), que
 * és el que /prova rep del servidor.
 *
 * La clau no porta servei. Es tracta com a ocupant exclusiu, que és el que és a
 * /prova: una prova és una sessió individual i no hi cap res al costat.
 */
export function occupancyFromSlotKeys(busy: Set<string>): OccupancyLookup {
  return (trainerId, start, durationMinutes) => {
    const day = localDateStr(start);
    const from = localSlotOf(start);
    const out: Occupant[] = [];
    for (let i = 0; i < slotsFor(durationMinutes); i++)
      if (busy.has(`${trainerId}|${day}|${from + i}`))
        out.push({ serviceType: "ep_individual" });
    return out;
  };
}

/**
 * Els serveis que es poden reservar com a sessió NOVA en aquest inici.
 *
 * `date` és el dia (com a les cel·les del calendari) i `slot`, la mitja hora on
 * comença. Buit si no hi cap res.
 */
export function freeServicesAt(input: {
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
  trainerId: string;
  date: Date;
  slot: number;
  durationMinutes?: number;
  occupancy: OccupancyLookup;
}): Set<ServiceType> {
  const duration = input.durationMinutes ?? SESSION_DURATION_MINUTES;
  const offered = offeredServices(
    input.rules,
    input.blocks,
    input.trainerId,
    input.date,
    input.slot,
    duration,
  );
  if (offered.size === 0) return offered;
  const start = new Date(input.date);
  start.setHours(0, input.slot * SLOT_MINUTES, 0, 0);
  const occupants = input.occupancy(input.trainerId, start, duration);
  if (occupants.length === 0) return offered;
  const out = new Set<ServiceType>();
  for (const s of offered) if (hasRoom(occupants, s)) out.add(s);
  return out;
}
