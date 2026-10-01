/**
 * Les hores que un client pot reservar, dia a dia i servei a servei.
 *
 * És el cor de la pantalla de Reserves del client (direcció A): tria el servei,
 * tria el dia —cada dia diu quantes hores té— i veu la llista d'hores lliures.
 * Aquí no hi ha res de pantalla: només la resposta a «què puc reservar aquell
 * dia d'aquest servei», perquè la puguin fer servir la llista, la tira de dies
 * i el script de comprovació sense tres còpies de la regla.
 *
 * LA REGLA ÉS LA DEL SERVIDOR, PEÇA A PEÇA
 *
 *   · Cobertura: la mateixa que `isSessionCovered` (regla que ofereix el
 *     servei amb la sessió SENCERA a dins, i cap bloqueig que la toqui), amb
 *     `isServiceAvailableOn` i `isRangeBlocked`, les dues peces que fa servir.
 *   · Lloc: `hasRoom` sobre els ocupants per solapament (lib/free-slots.ts), com
 *     `freeServicesAt` i `slotHasRoom`.
 *   · Amb qui: `clientBookingScope` (lib/booking-scope.ts, C1). Individual i
 *     parelles, només amb l'entrenador assignat; grup i fisio, amb qualsevol que
 *     ho ofereixi a la disponibilitat.
 *   · Antelació mínima per reservar, i que el client no tingui res més que es
 *     trepitgi amb aquella hora.
 *
 * PER QUÈ NO CRIDA `freeServicesAt` TAL QUAL
 *
 * `freeServicesAt` llegeix el dia i l'hora amb els getters LOCALS del `Date`,
 * pensat per a la graella del navegador. Aquesta llista es pinta primer AL
 * SERVIDOR (UTC a Vercel) i després al navegador (hora de Madrid): amb getters
 * locals, les dues passades veurien hores diferents, que és exactament l'error
 * d'hidratació #418 que tenia la graella (la primera fila hi sortia a les 06:00
 * al servidor i a les 07:00 al navegador). Aquí tot es compta en hora del
 * CENTRE a partir d'un dia "YYYY-MM-DD" i d'un `now` que arriba del servidor, de
 * manera que el resultat és el mateix a tot arreu. Les peces són les mateixes.
 */
import { GROUP_CAPACITY, SESSION_DURATION_MINUTES } from "@/lib/labels";
import {
  blocksOf,
  hourToSlot,
  isRangeBlocked,
  isServiceAvailableOn,
  slotsFor,
  slotToHHMM,
  weekdayOfDay,
  type TrainerBlockLite,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import { addDaysStr, centerLocalToInstant } from "@/lib/center-time";
import { hasRoom, occupancyFromSessions, type OccupancyLookup } from "@/lib/free-slots";
import { clientBookingScope, requiresAssignedTrainer } from "@/lib/booking-scope";
import type { ServiceType } from "@/types/database";

/** El que la llista necessita saber d'una reserva del centre. */
export type SlotReservation = {
  id: string;
  trainerId: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: string;
  isOwn: boolean;
  mateName: string | null;
};

export type DaySlotsInput = {
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
  trainerIds: string[];
  reservations: SlotReservation[];
  assignedTrainerId: string | null;
  /** Instant de referència, en mil·lisegons. Arriba del servidor. */
  nowMs: number;
  /** Antelació mínima per reservar (configuració del centre). */
  minBookingHours: number;
  openingHour: number;
  closingHour: number;
  waitlistEnabled: boolean;
  /** Les esperes vives del client. */
  waitlist: { id: string; trainerId: string | null; desiredAt: string }[];
};

/** Una fila de la llista d'hores. */
export type HourRow =
  | {
      kind: "free";
      at: string;
      hhmm: string;
      /** Qui la pot fer, ja filtrat per la regla d'amb qui. Mai buit. */
      trainerIds: string[];
    }
  | {
      kind: "group";
      at: string;
      hhmm: string;
      trainerId: string;
      /** Places ocupades (0 = grup nou, seràs el primer). */
      count: number;
      /** Noms de pila dels que hi són (només grups; vegeu client-calendar.ts). */
      mates: string[];
      /** Hi cap una plaça més i la pots agafar. */
      canJoin: boolean;
      /** És ple i et pots apuntar a la cua. */
      canWait: boolean;
      /** Ja hi ets a la cua: l'id de l'espera, per donar-te'n de baixa. */
      waitingEntryId: string | null;
    }
  | {
      kind: "own";
      at: string;
      hhmm: string;
      reservationId: string;
      trainerId: string | null;
      service: ServiceType;
      /** En un grup, quants hi sou. */
      groupCount?: number;
      mates: string[];
    };

/** Una fila es pot reservar (o fer-hi cua) ara mateix? La tira de dies les compta. */
export function isBookable(r: HourRow): boolean {
  return r.kind === "free" || (r.kind === "group" && r.canJoin);
}

const DURATION = SESSION_DURATION_MINUTES;
const DURATION_MS = DURATION * 60_000;

/**
 * Un índex que es construeix un cop per pantalla i serveix per a tots els dies:
 * l'ocupació per professional i les sessions pròpies.
 */
export function prepare(input: DaySlotsInput) {
  const booked = input.reservations.filter((r) => r.status === "booked");
  const occupancy: OccupancyLookup = occupancyFromSessions(
    booked.map((r) => ({
      trainerId: r.trainerId,
      scheduledAt: r.scheduledAt,
      serviceType: r.serviceType,
    })),
  );
  const own = booked.filter((r) => r.isOwn);
  const ownRanges = own.map((r) => {
    const s = new Date(r.scheduledAt).getTime();
    return { s, e: s + DURATION_MS };
  });
  const rulesBy = new Map<string, TrainerRuleLite[]>();
  for (const r of input.rules) {
    const list = rulesBy.get(r.trainerId) ?? [];
    list.push(r);
    rulesBy.set(r.trainerId, list);
  }
  const blocksBy = new Map(input.trainerIds.map((t) => [t, blocksOf(input.blocks, t)]));
  const waitingBy = new Map<string, string>();
  for (const w of input.waitlist)
    waitingBy.set(`${w.trainerId}|${new Date(w.desiredAt).getTime()}`, w.id);
  return { input, booked, occupancy, own, ownRanges, rulesBy, blocksBy, waitingBy };
}
export type Prepared = ReturnType<typeof prepare>;

/**
 * El client no pot reservar individual ni parelles perquè no té entrenador
 * (C1). La pantalla ho diu en comptes d'una llista buida.
 */
export function lacksTrainerFor(service: ServiceType, assignedTrainerId: string | null): boolean {
  return requiresAssignedTrainer(service) && !assignedTrainerId;
}

/** Les hores d'un dia (hora del centre) per a un servei. */
export function hoursFor(p: Prepared, day: string, service: ServiceType): HourRow[] {
  const { input } = p;
  const wd = weekdayOfDay(day);
  const firstSlot = hourToSlot(input.openingHour);
  const lastSlot = hourToSlot(input.closingHour) - slotsFor(DURATION);
  const earliest = input.nowMs + input.minBookingHours * 3_600_000;
  const trainers = input.trainerIds.filter(
    (t) =>
      clientBookingScope({ serviceType: service, trainerId: t, assignedTrainerId: input.assignedTrainerId }) === "ok",
  );
  const rows: HourRow[] = [];

  for (let slot = firstSlot; slot <= lastSlot; slot++) {
    const hhmm = slotToHHMM(slot);
    const start = centerLocalToInstant(day, hhmm);
    const ms = start.getTime();
    if (ms <= input.nowMs) continue;
    const at = start.toISOString();

    // Les teves d'aquest servei que comencen aquí surten sempre (també si són
    // massa a prop per reservar-ne una de nova).
    for (const r of p.own) {
      if (r.serviceType !== service || new Date(r.scheduledAt).getTime() !== ms) continue;
      const mates =
        service === "grupo_reducido"
          ? p.booked
              .filter(
                (x) =>
                  !x.isOwn &&
                  x.trainerId === r.trainerId &&
                  x.serviceType === "grupo_reducido" &&
                  new Date(x.scheduledAt).getTime() === ms,
              )
              .map((x) => x.mateName)
              .filter((n): n is string => !!n)
          : [];
      rows.push({
        kind: "own",
        at,
        hhmm,
        reservationId: r.id,
        trainerId: r.trainerId,
        service,
        groupCount: service === "grupo_reducido" ? mates.length + 1 : undefined,
        mates,
      });
    }

    // Res de nou si és massa a prop o si ja tens alguna cosa que s'hi trepitja.
    if (ms < earliest) continue;
    if (p.ownRanges.some((o) => o.s < ms + DURATION_MS && ms < o.e)) continue;

    const free: string[] = [];
    for (const t of trainers) {
      const covered =
        isServiceAvailableOn(p.rulesBy.get(t) ?? [], day, wd, slot, service, DURATION) &&
        !isRangeBlocked(p.blocksBy.get(t) ?? [], ms, ms + DURATION_MS);
      if (!covered) continue;
      const occupants = p.occupancy(t, start, DURATION);

      if (service === "grupo_reducido") {
        // El grup de la franja: els qui hi comencen a aquesta hora exacta.
        const here = p.booked.filter(
          (x) =>
            x.trainerId === t &&
            x.serviceType === "grupo_reducido" &&
            new Date(x.scheduledAt).getTime() === ms,
        );
        const room = hasRoom(occupants, "grupo_reducido");
        // Ple de debò: el grup ha arribat a l'aforament. Si el que ho tapa és
        // una sessió d'un altre servei, no és un grup ple: no hi ha grup.
        const full =
          !room &&
          here.length >= GROUP_CAPACITY &&
          occupants.every((o) => o.serviceType === "grupo_reducido");
        if (!room && !full) continue;
        const waitingEntryId = p.waitingBy.get(`${t}|${ms}`) ?? null;
        rows.push({
          kind: "group",
          at,
          hhmm,
          trainerId: t,
          count: here.length,
          mates: here.map((x) => x.mateName).filter((n): n is string => !!n),
          canJoin: room,
          canWait: full && input.waitlistEnabled,
          waitingEntryId,
        });
        continue;
      }

      if (hasRoom(occupants, service)) free.push(t);
    }

    if (free.length > 0) rows.push({ kind: "free", at, hhmm, trainerIds: free });
  }
  return rows;
}

/**
 * Quants dies ensenya la tira de Reserves del client. Viu aquí i no al
 * component perquè el servidor (`getClientCenterData`) també el necessita: és
 * fins on ha de portar l'ocupació del centre.
 */
export const STRIP_DAYS = 21;

/** Els dies de la tira: d'avui en endavant, en hora del centre. */
export function stripDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysStr(today, i));
}

/** Quantes hores reservables té cada dia per a un servei. */
export function countsFor(p: Prepared, days: string[], service: ServiceType): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) out[d] = hoursFor(p, d, service).filter(isBookable).length;
  return out;
}

/**
 * Les teves properes sessions (qualsevol servei), de la més propera a la més
 * llunyana. Per a la capçalera.
 */
export function upcomingOwn(
  reservations: SlotReservation[],
  nowMs: number,
): SlotReservation[] {
  return reservations
    .filter((r) => r.isOwn && r.status === "booked" && new Date(r.scheduledAt).getTime() > nowMs)
    // Per instant i no per cadena: Postgres torna "+00:00" i la simulació "Z".
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}
