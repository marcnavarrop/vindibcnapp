import "server-only";
import { listAvailabilityLite } from "@/lib/data/availability";
import { listBlocksLite } from "@/lib/data/availability-blocks";
import { isSessionCovered } from "@/lib/availability-coverage";
import type { ServiceType } from "@/types/database";

/**
 * ¿Aquest professional ofereix ARA aquesta sessió? Regles i bloquejos llegits de
 * la base, i el predicat compartit (`isSessionCovered`).
 *
 * Existeix per a qui ha de decidir sense ningú davant: la promoció de la llista
 * d'espera i l'allargament de sèries. Els dos llegeixen amb la clau de servei
 * (a través de `listAvailabilityLite` i `listBlocksLite`), perquè corren també
 * des del cron i del webhook de Stripe, on no hi ha sessió.
 */
export async function isSessionOffered(
  trainerId: string,
  startIso: string,
  durationMinutes: number,
  serviceType: ServiceType,
): Promise<boolean> {
  const [rules, blocks] = await Promise.all([
    listAvailabilityLite(trainerId),
    listBlocksLite(trainerId),
  ]);
  return isSessionCovered(rules, blocks, startIso, durationMinutes, serviceType);
}
