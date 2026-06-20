import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
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
  assignedTrainerId: string | null;
  notes: string | null;
  bonos: ClientBono[];
  reservations: ClientReservation[];
  payments: ClientPayment[];
};

export type ClientInput = {
  fullName: string;
  email: string;
  phone: string | null;
  assignedTrainerId: string | null;
  notes: string | null;
};

// ── Helpers de simulación ──
function toListItem(clientId: string, store = getStore()): ClientListItem {
  const client = store.clients.find((c) => c.id === clientId)!;
  const profile = store.profiles.find((p) => p.id === client.profile_id);
  const trainer = client.assigned_trainer_id
    ? store.profiles.find((p) => p.id === client.assigned_trainer_id)
    : null;
  const bonos = store.bonos.filter(
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
    const store = getStore();
    return store.clients
      .filter((c) => !trainerId || c.assigned_trainer_id === trainerId)
      .map((c) => toListItem(c.id, store));
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
  const store = getStore();
  const client = store.clients.find((c) => c.id === clientId);
  if (!client) return null;
  return {
    ...toListItem(clientId, store),
    assignedTrainerId: client.assigned_trainer_id,
    notes: client.notes,
    bonos: store.bonos
      .filter((b) => b.client_id === clientId)
      .map((b) => ({
        id: b.id,
        serviceType: b.service_type,
        totalSessions: b.total_sessions,
        remainingSessions: b.remaining_sessions,
        price: b.price,
        status: b.status,
      })),
    reservations: store.reservations
      .filter((r) => r.client_id === clientId)
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
      })),
    payments: store.payments
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
  throw new Error("getClient: pendiente de implementar contra Supabase");
}

/** Ficha del cliente que corresponde a un perfil (área cliente). */
export async function getClientByProfile(
  profileId: string,
): Promise<ClientDetail | null> {
  if (USE_MOCK) {
    const client = getStore().clients.find((c) => c.profile_id === profileId);
    return client ? buildDetail(client.id) : null;
  }
  throw new Error(
    "getClientByProfile: pendiente de implementar contra Supabase",
  );
}

/** Entrenadores disponibles para asignar (para los selects de formularios). */
export async function listTrainers(): Promise<{ id: string; name: string }[]> {
  if (USE_MOCK) {
    return getStore()
      .profiles.filter((p) => p.role === "trainer")
      .map((p) => ({ id: p.id, name: p.full_name ?? "—" }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainer")
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "—" }));
}

/** Crea un cliente (y su perfil). Devuelve el id del nuevo cliente. */
export async function createClientRecord(input: ClientInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const profileId = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    store.profiles.push({
      id: profileId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      role: "client",
      created_at: createdAt,
    });
    store.clients.push({
      id: clientId,
      profile_id: profileId,
      assigned_trainer_id: input.assignedTrainerId,
      notes: input.notes,
      created_at: createdAt,
    });
    saveStore(store);
    return clientId;
  }
  throw new Error("createClientRecord: pendiente de implementar contra Supabase");
}

/** Actualiza los datos de un cliente existente. */
export async function updateClientRecord(
  id: string,
  input: ClientInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.id === id);
    if (!client) throw new Error("Cliente no encontrado");
    client.assigned_trainer_id = input.assignedTrainerId;
    client.notes = input.notes;
    const profile = store.profiles.find((p) => p.id === client.profile_id);
    if (profile) {
      profile.full_name = input.fullName;
      profile.email = input.email;
      profile.phone = input.phone;
    }
    saveStore(store);
    return;
  }
  throw new Error("updateClientRecord: pendiente de implementar contra Supabase");
}
