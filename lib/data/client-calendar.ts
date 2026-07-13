import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import type { TrainerRuleLite } from "@/lib/availability-slots";
import type { ServiceType, ReservationStatus } from "@/types/database";

/** Reserva del centro para el calendario del cliente (SIN nombres de otros). */
export type CenterReservation = {
  id: string;
  trainerId: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  isOwn: boolean;
};

export type ClientCenterData = {
  clientId: string | null;
  /** Tipos de servicio que el cliente puede reservar (bonos activos con sesiones). */
  bonoTypes: ServiceType[];
  trainers: { id: string; name: string }[];
  rules: TrainerRuleLite[];
  reservations: CenterReservation[];
};

const EMPTY: ClientCenterData = {
  clientId: null,
  bonoTypes: [],
  trainers: [],
  rules: [],
  reservations: [],
};

/**
 * Datos para el calendario GLOBAL del cliente: la disponibilidad de todos los
 * profesionales, los tipos de bono activos del cliente (lo que determina qué
 * puede reservar) y la ocupación (anonimizada). La anonimización se hace aquí.
 */
export async function getClientCenterData(
  profileId: string,
): Promise<ClientCenterData> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    if (!client) return EMPTY;
    const bonoTypes = [
      ...new Set(
        store.bonos
          .filter(
            (b) =>
              b.client_id === client.id &&
              b.status === "active" &&
              b.remaining_sessions > 0,
          )
          .map((b) => b.service_type),
      ),
    ];
    const trainers = store.profiles
      .filter((p) => p.role === "trainer")
      .map((p) => ({ id: p.id, name: p.full_name ?? "—" }));
    const rules = store.availability_rules.map((r) => ({
      trainerId: r.trainer_id,
      weekday: r.weekday,
      startHour: parseInt(r.start_time.slice(0, 2), 10),
      endHour: parseInt(r.end_time.slice(0, 2), 10),
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      serviceTypes: r.service_types ?? [],
    }));
    const reservations = store.reservations
      .filter((r) => r.status !== "cancelled")
      .map((r) => ({
        id: r.id,
        trainerId: r.trainer_id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
        isOwn: r.client_id === client.id,
      }));
    return { clientId: client.id, bonoTypes, trainers, rules, reservations };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .single();
  if (!client) return EMPTY;

  const [bonoRows, trainerRows, rules, resRows] = await Promise.all([
    admin
      .from("bonos")
      .select("service_type, status, remaining_sessions")
      .eq("client_id", client.id),
    admin.from("profiles").select("id, full_name").eq("role", "trainer"),
    listAllTrainerRulesLite(),
    admin
      .from("reservations")
      .select("id, client_id, trainer_id, scheduled_at, service_type, status")
      .neq("status", "cancelled"),
  ]);

  const bonoTypes = [
    ...new Set(
      (bonoRows.data ?? [])
        .filter((b) => b.status === "active" && b.remaining_sessions > 0)
        .map((b) => b.service_type),
    ),
  ];
  const trainers = (trainerRows.data ?? []).map((t) => ({
    id: t.id,
    name: t.full_name ?? "—",
  }));
  const reservations: CenterReservation[] = (resRows.data ?? []).map((r) => ({
    id: r.id,
    trainerId: r.trainer_id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
    isOwn: r.client_id === client.id,
  }));

  return { clientId: client.id, bonoTypes, trainers, rules, reservations };
}
