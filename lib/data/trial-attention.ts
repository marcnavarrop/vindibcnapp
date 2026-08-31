import "server-only";
import { listPendingTrialRequests } from "@/lib/data/trial-bookings";

/** Una sol·licitud de prova esperant resposta, ja preparada per pintar. */
export type TrialAttentionItem = {
  id: string;
  name: string;
  scheduledAt: string;
  trainerName: string | null;
  /** Hores que falten perquè caduqui (mai negatiu). */
  hoursLeft: number;
};

/**
 * Les proves pendents, per a la secció d'atenció immediata.
 *
 * La comparteixen l'inici de l'admin (totes) i el del professional (les
 * seves): el compte enrere i el criteri d'arrodoniment han de ser els
 * mateixos a les dues pantalles, i si viuen a dos llocs acaben divergint.
 *
 * `floor` i no arrodonint: davant d'un termini val més quedar-se curt que
 * prometre temps que no hi és.
 *
 * La lectura de sota és PURA —no escombra res—, i comprova la caducitat per
 * data i no per l'estat desat, que pot anar endarrerit.
 */
export async function pendingTrialAttention(
  trainerId?: string,
): Promise<TrialAttentionItem[]> {
  const trials = await listPendingTrialRequests(trainerId);
  const now = Date.now();
  return trials.map((t) => ({
    id: t.id,
    name: t.fullName,
    scheduledAt: t.scheduledAt,
    trainerName: t.trainerName,
    hoursLeft: Math.max(
      0,
      Math.floor((new Date(t.expiresAt).getTime() - now) / 3_600_000),
    ),
  }));
}

/** El text del compte enrere, igual a les dues pantalles. */
export function countdownLabel(hoursLeft: number): string {
  if (hoursLeft === 0) return "caduca en menys d'una hora";
  if (hoursLeft === 1) return "caduca en 1 h";
  return `caduca en ${hoursLeft} h`;
}
