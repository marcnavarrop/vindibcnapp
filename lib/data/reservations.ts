import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { listTrainers } from "@/lib/data/clients";
import type { ServiceType, ReservationStatus } from "@/types/database";

export type ReservationListItem = {
  id: string;
  clientId: string;
  clientName: string;
  trainerId: string | null;
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
        clientId: r.client_id,
        clientName: nameOfClient(r.client_id, store),
        trainerId: r.trainer_id,
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
      `id, client_id, scheduled_at, service_type, status, trainer_id,
       client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
       trainer:profiles!reservations_trainer_id_fkey(full_name)`,
    )
    .order("scheduled_at", { ascending: true });
  if (trainerId) query = query.eq("trainer_id", trainerId);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    client_id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer_id: string | null;
    client: { profile: { full_name: string | null } | null } | null;
    trainer: { full_name: string | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.profile?.full_name ?? "—",
    trainerId: r.trainer_id,
    trainerName: r.trainer?.full_name ?? null,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
  }));
}

// ─────────────────────────── Escritura ───────────────────────────

/** Datos para el formulario de nueva reserva: clientes con sus bonos
 *  disponibles (activos y con sesiones) y la lista de entrenadores. */
export type ReservationFormData = {
  clients: {
    id: string;
    name: string;
    bonos: { id: string; serviceType: ServiceType; remaining: number }[];
  }[];
  trainers: { id: string; name: string }[];
};

export async function getReservationFormData(
  onlyTrainerId?: string,
): Promise<ReservationFormData> {
  const trainers = await listTrainers();

  if (USE_MOCK) {
    const store = getStore();
    const clients = store.clients
      .filter((c) => !onlyTrainerId || c.assigned_trainer_id === onlyTrainerId)
      .map((c) => {
      const profile = store.profiles.find((p) => p.id === c.profile_id);
      return {
        id: c.id,
        name: profile?.full_name ?? "—",
        bonos: store.bonos
          .filter(
            (b) =>
              b.client_id === c.id &&
              b.status === "active" &&
              b.remaining_sessions > 0,
          )
          .map((b) => ({
            id: b.id,
            serviceType: b.service_type,
            remaining: b.remaining_sessions,
          })),
      };
    });
    return { clients, trainers };
  }

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, service_type, remaining_sessions, status)`,
    )
    .order("created_at", { ascending: true });
  if (onlyTrainerId) query = query.eq("assigned_trainer_id", onlyTrainerId);
  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    profile: { full_name: string | null } | null;
    bonos: {
      id: string;
      service_type: ServiceType;
      remaining_sessions: number;
      status: string;
    }[];
  };
  const clients = (data as unknown as Row[]).map((c) => ({
    id: c.id,
    name: c.profile?.full_name ?? "—",
    bonos: c.bonos
      .filter((b) => b.status === "active" && b.remaining_sessions > 0)
      .map((b) => ({
        id: b.id,
        serviceType: b.service_type,
        remaining: b.remaining_sessions,
      })),
  }));
  return { clients, trainers };
}

export type ReservationInput = {
  bonoId: string;
  trainerId: string | null;
  scheduledAt: string; // ISO
};

/**
 * Crea una o més reserves a partir d'un bo, consumint una sessió per reserva.
 * Amb `repeatWeeks > 1` crea una reserva cada setmana a la mateixa hora.
 */
export async function createReservation(
  input: ReservationInput,
  repeatWeeks = 1,
): Promise<void> {
  const weeks = Math.max(1, Math.floor(repeatWeeks));
  const base = new Date(input.scheduledAt).getTime();
  const dates = Array.from({ length: weeks }, (_, i) =>
    new Date(base + i * 7 * 24 * 60 * 60 * 1000).toISOString(),
  );

  if (USE_MOCK) {
    const store = getStore();
    const bono = store.bonos.find((b) => b.id === input.bonoId);
    if (!bono) throw new Error("Bo no trobat.");
    if (bono.remaining_sessions < weeks)
      throw new Error(
        `Aquest bo només té ${bono.remaining_sessions} sessions disponibles.`,
      );
    for (const scheduled_at of dates) {
      store.reservations.push({
        id: crypto.randomUUID(),
        client_id: bono.client_id,
        bono_id: bono.id,
        trainer_id: input.trainerId,
        scheduled_at,
        service_type: bono.service_type,
        status: "booked",
        created_at: new Date().toISOString(),
      });
    }
    bono.remaining_sessions -= weeks;
    if (bono.remaining_sessions === 0) bono.status = "completed";
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { data: bono, error: bErr } = await supabase
    .from("bonos")
    .select("id, client_id, service_type, remaining_sessions")
    .eq("id", input.bonoId)
    .single();
  if (bErr || !bono) throw new Error("Bo no trobat.");
  if (bono.remaining_sessions < weeks)
    throw new Error(
      `Aquest bo només té ${bono.remaining_sessions} sessions disponibles.`,
    );

  const { error: rErr } = await supabase.from("reservations").insert(
    dates.map((scheduled_at) => ({
      client_id: bono.client_id,
      bono_id: bono.id,
      trainer_id: input.trainerId,
      scheduled_at,
      service_type: bono.service_type,
      status: "booked" as const,
    })),
  );
  if (rErr) throw rErr;

  const remaining = bono.remaining_sessions - weeks;
  const { error: uErr } = await supabase
    .from("bonos")
    .update({
      remaining_sessions: remaining,
      ...(remaining === 0 ? { status: "completed" as const } : {}),
    })
    .eq("id", bono.id);
  if (uErr) throw uErr;
}

/** Cancela una reserva reservada y devuelve la sesión a su bono. */
export async function cancelReservation(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find((x) => x.id === id);
    if (!r) throw new Error("Reserva no trobada.");
    if (r.status !== "booked") return;
    r.status = "cancelled";
    if (r.bono_id) {
      const bono = store.bonos.find((b) => b.id === r.bono_id);
      if (bono) {
        bono.remaining_sessions = Math.min(
          bono.remaining_sessions + 1,
          bono.total_sessions,
        );
        if (bono.status === "completed") bono.status = "active";
      }
    }
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("reservations")
    .select("id, status, bono_id")
    .eq("id", id)
    .single();
  if (error || !r) throw new Error("Reserva no trobada.");
  if (r.status !== "booked") return;

  const { error: uErr } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (uErr) throw uErr;

  if (r.bono_id) {
    const { data: bono } = await supabase
      .from("bonos")
      .select("remaining_sessions, total_sessions, status")
      .eq("id", r.bono_id)
      .single();
    if (bono) {
      const remaining = Math.min(
        bono.remaining_sessions + 1,
        bono.total_sessions,
      );
      await supabase
        .from("bonos")
        .update({
          remaining_sessions: remaining,
          ...(bono.status === "completed" ? { status: "active" as const } : {}),
        })
        .eq("id", r.bono_id);
    }
  }
}

/** Marca una reserva reservada como realizada. */
export async function completeReservation(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find((x) => x.id === id);
    if (!r) throw new Error("Reserva no trobada.");
    if (r.status === "booked") r.status = "completed";
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("status", "booked");
  if (error) throw error;
}
