import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import type {
  AvailabilityBlockLite,
  TrainerBlockLite,
} from "@/lib/availability-slots";

export type AvailabilityBlock = {
  id: string;
  trainerId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
};

const toBlock = (r: {
  id: string;
  trainer_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
}): AvailabilityBlock => ({
  id: r.id,
  trainerId: r.trainer_id,
  startAt: r.start_at,
  endAt: r.end_at,
  reason: r.reason,
  createdAt: r.created_at,
});

/**
 * Bloqueos de un profesional que aún no han terminado (activos o futuros),
 * ordenados por inicio. Es lo que interesa mostrar en la UI de gestión.
 */
export async function listUpcomingBlocks(
  trainerId: string,
): Promise<AvailabilityBlock[]> {
  const nowIso = new Date().toISOString();

  if (USE_MOCK) {
    return getStore()
      .availability_blocks.filter(
        (b) => b.trainer_id === trainerId && b.end_at > nowIso,
      )
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .map(toBlock);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, trainer_id, start_at, end_at, reason, created_at")
    .eq("trainer_id", trainerId)
    .gt("end_at", nowIso)
    .order("start_at");
  if (error) throw error;
  return (data ?? []).map(toBlock);
}

/** Bloqueos de un profesional, en formato ligero para el cálculo de franjas. */
export async function listBlocksLite(
  trainerId: string,
): Promise<AvailabilityBlockLite[]> {
  if (USE_MOCK) {
    return getStore()
      .availability_blocks.filter((b) => b.trainer_id === trainerId)
      .map((b) => ({ startAt: b.start_at, endAt: b.end_at }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("start_at, end_at")
    .eq("trainer_id", trainerId);
  if (error) throw error;
  return (data ?? []).map((b) => ({ startAt: b.start_at, endAt: b.end_at }));
}

/** Bloqueos de TODOS los profesionales (calendario global del cliente). */
export async function listAllBlocksLite(): Promise<TrainerBlockLite[]> {
  if (USE_MOCK) {
    return getStore().availability_blocks.map((b) => ({
      trainerId: b.trainer_id,
      startAt: b.start_at,
      endAt: b.end_at,
    }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("trainer_id, start_at, end_at");
  if (error) throw error;
  return (data ?? []).map((b) => ({
    trainerId: b.trainer_id,
    startAt: b.start_at,
    endAt: b.end_at,
  }));
}

export type CreateBlockInput = {
  trainerId: string;
  startAt: string; // ISO
  endAt: string; // ISO
  reason: string | null;
  createdBy: string | null;
};

export async function createAvailabilityBlock(
  input: CreateBlockInput,
): Promise<string> {
  if (new Date(input.endAt) <= new Date(input.startAt))
    throw new Error("La data de fi ha de ser posterior a la d'inici.");

  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.availability_blocks.push({
      id,
      trainer_id: input.trainerId,
      start_at: input.startAt,
      end_at: input.endAt,
      reason: input.reason,
      created_by: input.createdBy,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .insert({
      trainer_id: input.trainerId,
      start_at: input.startAt,
      end_at: input.endAt,
      reason: input.reason,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No s'ha pogut crear el bloqueig.");
  return data.id;
}

/** Elimina un bloqueo. Solo se permite si aún no ha empezado. */
export async function deleteAvailabilityBlock(id: string): Promise<void> {
  const now = new Date();

  if (USE_MOCK) {
    const store = getStore();
    const b = store.availability_blocks.find((x) => x.id === id);
    if (!b) return;
    if (new Date(b.start_at) <= now)
      throw new Error("Només es poden eliminar bloquejos que encara no han començat.");
    store.availability_blocks = store.availability_blocks.filter(
      (x) => x.id !== id,
    );
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { data: b } = await supabase
    .from("availability_blocks")
    .select("start_at")
    .eq("id", id)
    .maybeSingle();
  if (!b) return;
  if (new Date(b.start_at) <= now)
    throw new Error("Només es poden eliminar bloquejos que encara no han començat.");

  const { error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export type AffectedReservation = {
  id: string;
  clientName: string;
  scheduledAt: string;
  serviceType: string;
};

/**
 * Reservas 'booked' de un profesional que caen dentro de un rango. Se usa para
 * avisar ANTES de crear el bloqueo: nunca se cancelan solas, es el profesional
 * quien decide reserva por reserva.
 */
export async function listReservationsInRange(
  trainerId: string,
  startAt: string,
  endAt: string,
): Promise<AffectedReservation[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.reservations
      .filter(
        (r) =>
          r.trainer_id === trainerId &&
          r.status === "booked" &&
          r.scheduled_at >= startAt &&
          r.scheduled_at < endAt,
      )
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .map((r) => {
        const client = store.clients.find((c) => c.id === r.client_id);
        const profile = store.profiles.find((p) => p.id === client?.profile_id);
        return {
          id: r.id,
          clientName: profile?.full_name ?? "—",
          scheduledAt: r.scheduled_at,
          serviceType: r.service_type,
        };
      });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `id, scheduled_at, service_type,
       client:clients!reservations_client_id_fkey(
         profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .eq("trainer_id", trainerId)
    .eq("status", "booked")
    .gte("scheduled_at", startAt)
    .lt("scheduled_at", endAt)
    .order("scheduled_at");
  if (error) throw error;

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      scheduled_at: string;
      service_type: string;
      client: { profile: { full_name: string | null } | null } | null;
    }>
  ).map((r) => ({
    id: r.id,
    clientName: r.client?.profile?.full_name ?? "—",
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
  }));
}
