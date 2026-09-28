import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { listAvailabilityLite } from "@/lib/data/availability";
import { listBlocksLite } from "@/lib/data/availability-blocks";
import { fetchAllActiveHolds } from "@/lib/data/trial-bookings";
import type { TrainerBlockLite, TrainerRuleLite } from "@/lib/availability-slots";
import type { KnownSession } from "@/lib/free-slots";
import type { ServiceType } from "@/types/database";

/** Dies endavant on es busquen inicis per reprogramar. */
export const RESCHEDULE_DAYS = 14;

/**
 * EL QUE CAL PER DIR ON ES POT MOURE UNA RESERVA.
 *
 * No es calculen aquí els inicis: es calculen al navegador amb `freeServicesAt`
 * (lib/free-slots.ts), en la mateixa hora que la rejilla, i així el que surt a
 * la llista és exactament el que la rejilla pinta com a lliure. Aquí es porten
 * les peces, per als propers `RESCHEDULE_DAYS` dies:
 *
 *   · les regles i els bloquejos del professional;
 *   · el que ocupa la seva agenda (reserves vives i proves actives), SENSE la
 *     reserva que es mou: la seva hora actual i les contigües compten lliures.
 *
 * Només hores i serveis: ni noms ni clients. El servidor torna a comprovar-ho
 * tot en moure (`reschedule_reservation`, 0093).
 */
export type RescheduleOptionsData = {
  trainerId: string;
  serviceType: ServiceType;
  scheduledAt: string;
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
  occupied: KnownSession[];
};

export async function getRescheduleOptionsData(
  id: string,
): Promise<RescheduleOptionsData | null> {
  const from = new Date();
  const to = new Date(from.getTime() + (RESCHEDULE_DAYS + 1) * 86_400_000);

  let r: { trainer_id: string | null; service_type: ServiceType; scheduled_at: string } | null;
  let occupied: KnownSession[];
  if (USE_MOCK) {
    const s = getStore();
    r = s.reservations.find((x) => x.id === id && x.status === "booked") ?? null;
    if (!r?.trainer_id) return null;
    const trainerId = r.trainer_id;
    const nowMs = Date.now();
    occupied = [
      ...s.reservations
        .filter(
          (x) =>
            x.id !== id &&
            x.trainer_id === trainerId &&
            x.status === "booked" &&
            new Date(x.scheduled_at) < to &&
            new Date(x.scheduled_at).getTime() + 3 * 3600_000 > from.getTime(),
        )
        .map((x) => ({
          trainerId,
          scheduledAt: x.scheduled_at,
          serviceType: x.service_type,
          durationMinutes: x.duration_minutes,
        })),
      ...s.trial_bookings
        .filter(
          (t) =>
            t.trainer_id === trainerId &&
            (t.status === "confirmed" ||
              (t.status === "pending" && new Date(t.expires_at).getTime() >= nowMs)),
        )
        .map((t) => ({ trainerId, scheduledAt: t.scheduled_at, serviceType: t.service_type })),
    ];
  } else {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("reservations")
      .select("trainer_id, service_type, scheduled_at")
      .eq("id", id)
      .eq("status", "booked")
      .maybeSingle();
    if (error) throw error;
    r = data;
    if (!r?.trainer_id) return null;
    const trainerId = r.trainer_id;
    const [res, holds] = await Promise.all([
      admin
        .from("reservations")
        .select("id, scheduled_at, service_type, duration_minutes")
        .eq("trainer_id", trainerId)
        .eq("status", "booked")
        .neq("id", id)
        // Una sessió que comença abans d'ara però encara dura també ocupa.
        .gte("scheduled_at", new Date(from.getTime() - 3 * 3600_000).toISOString())
        .lt("scheduled_at", to.toISOString()),
      fetchAllActiveHolds(admin),
    ]);
    if (res.error) throw res.error;
    occupied = [
      ...(res.data ?? []).map((x) => ({
        trainerId,
        scheduledAt: x.scheduled_at,
        serviceType: x.service_type as ServiceType,
        durationMinutes: x.duration_minutes,
      })),
      ...holds
        .filter((h) => h.trainer_id === trainerId)
        .map((h) => ({ trainerId, scheduledAt: h.scheduled_at, serviceType: h.service_type })),
    ];
  }

  const trainerId = r.trainer_id!;
  const [rules, blocks] = await Promise.all([
    listAvailabilityLite(trainerId),
    listBlocksLite(trainerId),
  ]);
  return {
    trainerId,
    serviceType: r.service_type,
    scheduledAt: r.scheduled_at,
    rules: rules.map((x) => ({ ...x, trainerId })),
    blocks: blocks.map((b) => ({ ...b, trainerId })),
    occupied,
  };
}
