import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, type Store } from "@/lib/mock/store";
import type { ServiceType, ReservationStatus } from "@/types/database";

export type ReservationListItem = {
  id: string;
  clientName: string;
  trainerName: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
};

function nameOfClient(clientId: string, store: Store): string {
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

function nameOfProfile(profileId: string | null, store: Store): string | null {
  if (!profileId) return null;
  return store.profiles.find((p) => p.id === profileId)?.full_name ?? null;
}

/**
 * Reservas. Si se pasa `trainerId`, solo las de ese entrenador (área trainer).
 */
export async function listReservations(
  trainerId?: string,
): Promise<ReservationListItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.reservations
      .filter((r) => !trainerId || r.trainer_id === trainerId)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .map((r) => ({
        id: r.id,
        clientName: nameOfClient(r.client_id, store),
        trainerName: nameOfProfile(r.trainer_id, store),
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
      }));
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select(
      `id, scheduled_at, service_type, status,
       client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
       trainer:profiles!reservations_trainer_id_fkey(full_name)`,
    )
    .order("scheduled_at", { ascending: true });
  if (trainerId) query = query.eq("trainer_id", trainerId);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    client: { profile: { full_name: string | null } | null } | null;
    trainer: { full_name: string | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    clientName: r.client?.profile?.full_name ?? "—",
    trainerName: r.trainer?.full_name ?? null,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
  }));
}
