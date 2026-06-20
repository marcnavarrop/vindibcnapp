import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import {
  seedClients,
  seedProfiles,
  seedBonos,
  seedReservations,
  seedPayments,
} from "@/lib/mock/seed";
import type {
  ServiceType,
  BonoStatus,
  ReservationStatus,
  PaymentMethod,
} from "@/types/database";

/** Cliente enriquecido para listados (nombre, entrenador, sesiones restantes). */
export type ClientListItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  trainerName: string | null;
  activeBonos: number;
  remainingSessions: number;
};

export type ClientBono = {
  id: string;
  serviceType: ServiceType;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  status: BonoStatus;
};

export type ClientReservation = {
  id: string;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
};

export type ClientPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
};

export type ClientDetail = ClientListItem & {
  notes: string | null;
  bonos: ClientBono[];
  reservations: ClientReservation[];
  payments: ClientPayment[];
};

// ── Helpers de simulación ──
function profileOf(profileId: string) {
  return seedProfiles.find((p) => p.id === profileId);
}

function toListItem(clientId: string): ClientListItem {
  const client = seedClients.find((c) => c.id === clientId)!;
  const profile = profileOf(client.profile_id);
  const trainer = client.assigned_trainer_id
    ? profileOf(client.assigned_trainer_id)
    : null;
  const bonos = seedBonos.filter(
    (b) => b.client_id === clientId && b.status === "active",
  );
  return {
    id: client.id,
    fullName: profile?.full_name ?? "—",
    email: profile?.email ?? "",
    phone: profile?.phone ?? null,
    trainerName: trainer?.full_name ?? null,
    activeBonos: bonos.length,
    remainingSessions: bonos.reduce((s, b) => s + b.remaining_sessions, 0),
  };
}

/**
 * Lista de clientes. Si se pasa `trainerId`, solo los asignados a ese
 * entrenador (área trainer). Misma firma en simulación y en real.
 */
export async function listClients(
  trainerId?: string,
): Promise<ClientListItem[]> {
  if (USE_MOCK) {
    return seedClients
      .filter((c) => !trainerId || c.assigned_trainer_id === trainerId)
      .map((c) => toListItem(c.id));
  }

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name, email, phone),
       trainer:profiles!clients_assigned_trainer_id_fkey(full_name),
       bonos(remaining_sessions, status)`,
    )
    .order("created_at", { ascending: true });
  if (trainerId) query = query.eq("assigned_trainer_id", trainerId);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    profile: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    trainer: { full_name: string | null } | null;
    bonos: { remaining_sessions: number; status: string }[];
  };
  return (data as unknown as Row[]).map((row) => {
    const active = row.bonos.filter((b) => b.status === "active");
    return {
      id: row.id,
      fullName: row.profile?.full_name ?? "—",
      email: row.profile?.email ?? "",
      phone: row.profile?.phone ?? null,
      trainerName: row.trainer?.full_name ?? null,
      activeBonos: active.length,
      remainingSessions: active.reduce((s, b) => s + b.remaining_sessions, 0),
    };
  });
}

function buildDetail(clientId: string): ClientDetail | null {
  const client = seedClients.find((c) => c.id === clientId);
  if (!client) return null;
  return {
    ...toListItem(clientId),
    notes: client.notes,
    bonos: seedBonos
      .filter((b) => b.client_id === clientId)
      .map((b) => ({
        id: b.id,
        serviceType: b.service_type,
        totalSessions: b.total_sessions,
        remainingSessions: b.remaining_sessions,
        price: b.price,
        status: b.status,
      })),
    reservations: seedReservations
      .filter((r) => r.client_id === clientId)
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
      })),
    payments: seedPayments
      .filter((p) => p.client_id === clientId)
      .map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        paidAt: p.paid_at,
      })),
  };
}

/** Ficha completa de un cliente por su id. */
export async function getClient(id: string): Promise<ClientDetail | null> {
  if (USE_MOCK) return buildDetail(id);
  // En real se implementará con varias consultas a Supabase.
  throw new Error("getClient: pendiente de implementar contra Supabase");
}

/** Ficha del cliente que corresponde a un perfil (área cliente). */
export async function getClientByProfile(
  profileId: string,
): Promise<ClientDetail | null> {
  if (USE_MOCK) {
    const client = seedClients.find((c) => c.profile_id === profileId);
    return client ? buildDetail(client.id) : null;
  }
  throw new Error(
    "getClientByProfile: pendiente de implementar contra Supabase",
  );
}
