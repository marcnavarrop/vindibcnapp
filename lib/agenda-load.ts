import { SESSION_DURATION_MINUTES } from "@/lib/labels";
import {
  blocksOf,
  isInstantBlocked,
  localDateStr,
  slotsFor,
  type TrainerBlockLite,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import { COUNTS_AS_OCCUPIED, occupancyOf } from "@/lib/occupancy";

/**
 * L'ocupació de `lib/occupancy.ts` per a l'agenda, que pinta en l'hora del
 * NAVEGADOR (com la rejilla): la tira de la setmana i el mode «Setmana» en
 * treuen la xifra d'aquí, i per tant és la mateixa que la de l'Inici.
 *
 * Torna una fracció (0..1), o `null` si aquell professional no té horari
 * aquells dies.
 */
export function agendaLoad(input: {
  trainerId: string;
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
  /** Les reserves de la finestra (de tothom: aquí es filtren). */
  reservations: { trainerId: string | null; scheduledAt: string; status: string }[];
  /** Dies en format YYYY-MM-DD, en hora local. */
  days: string[];
}): number | null {
  const { trainerId, days } = input;
  const daySet = new Set(days);
  const booked = new Set<string>();
  for (const r of input.reservations) {
    if (r.trainerId !== trainerId || !COUNTS_AS_OCCUPIED(r.status)) continue;
    const s = new Date(r.scheduledAt);
    const day = localDateStr(s);
    if (!daySet.has(day)) continue;
    const from = s.getHours() * 2 + Math.floor(s.getMinutes() / 30);
    for (let i = 0; i < slotsFor(SESSION_DURATION_MINUTES); i++) booked.add(`${day}|${from + i}`);
  }
  const blocks = blocksOf(input.blocks, trainerId);
  const { slots, pct } = occupancyOf(
    input.rules.filter((r) => r.trainerId === trainerId),
    days,
    (day, slot) => isInstantBlocked(blocks, slotInstant(day, slot)),
    (day, slot) => booked.has(`${day}|${slot}`),
  );
  return slots > 0 ? pct / 100 : null;
}

/** L'inici del slot, en hora local. */
function slotInstant(day: string, slot: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, slot * 30);
}
