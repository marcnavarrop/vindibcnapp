import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { createUserWithInvite } from "@/lib/notifications/auth-emails";
import type {
  ServiceType,
  BonoStatus,
  ReservationStatus,
  PaymentMethod,
  PreferredLanguage,
  Gender,
} from "@/types/database";

/** Cliente enriquecido para listados (nombre, entrenador, sesiones restantes). */
export type ClientListItem = {
  id: string;
  profileId: string;
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
  trainerName: string | null;
};

export type ClientPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
};

export type ClientDetail = ClientListItem & {
  profileId: string;
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
    profileId: client.profile_id,
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
      `id, profile_id,
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
    profile_id: string;
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
      profileId: row.profile_id,
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
    profileId: client.profile_id,
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
      .map((r) => {
        const trainer = r.trainer_id
          ? store.profiles.find((p) => p.id === r.trainer_id)
          : null;
        return {
          id: r.id,
          scheduledAt: r.scheduled_at,
          serviceType: r.service_type,
          status: r.status,
          trainerName: trainer?.full_name ?? null,
        };
      }),
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

// Ficha completa contra Supabase (id de cliente o id de perfil).
type DetailRow = {
  id: string;
  profile_id: string;
  assigned_trainer_id: string | null;
  notes: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  trainer: { full_name: string | null } | null;
  bonos: {
    id: string;
    service_type: ServiceType;
    total_sessions: number;
    remaining_sessions: number;
    price: number;
    status: BonoStatus;
  }[];
  reservations: {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer: { full_name: string | null } | null;
  }[];
  payments: {
    id: string;
    amount: number;
    method: PaymentMethod;
    paid_at: string;
  }[];
};

async function fetchClientDetail(
  column: "id" | "profile_id",
  value: string,
): Promise<ClientDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id, profile_id, assigned_trainer_id, notes,
       profile:profiles!clients_profile_id_fkey(full_name, email, phone),
       trainer:profiles!clients_assigned_trainer_id_fkey(full_name),
       bonos(id, service_type, total_sessions, remaining_sessions, price, status),
       reservations(id, scheduled_at, service_type, status, trainer:profiles!reservations_trainer_id_fkey(full_name)),
       payments(id, amount, method, paid_at)`,
    )
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const active = row.bonos.filter((b) => b.status === "active");
  return {
    id: row.id,
    fullName: row.profile?.full_name ?? "—",
    email: row.profile?.email ?? "",
    phone: row.profile?.phone ?? null,
    trainerName: row.trainer?.full_name ?? null,
    activeBonos: active.length,
    remainingSessions: active.reduce((s, b) => s + b.remaining_sessions, 0),
    profileId: row.profile_id,
    assignedTrainerId: row.assigned_trainer_id,
    notes: row.notes,
    bonos: row.bonos.map((b) => ({
      id: b.id,
      serviceType: b.service_type,
      totalSessions: b.total_sessions,
      remainingSessions: b.remaining_sessions,
      price: b.price,
      status: b.status,
    })),
    reservations: row.reservations
      .slice()
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
        trainerName: r.trainer?.full_name ?? null,
      })),
    payments: row.payments.map((p) => ({
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
  return fetchClientDetail("id", id);
}

/** Ficha del cliente que corresponde a un perfil (área cliente). */
export async function getClientByProfile(
  profileId: string,
): Promise<ClientDetail | null> {
  if (USE_MOCK) {
    const client = getStore().clients.find((c) => c.profile_id === profileId);
    return client ? buildDetail(client.id) : null;
  }
  return fetchClientDetail("profile_id", profileId);
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
      specialty: null,
      preferred_language: "ca",
      birth_date: null,
      height_cm: null,
      weight_kg: null,
      gender: null,
      emergency_contact: null,
      objective: null,
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

  // Crea l'usuari (el trigger crea el perfil) i li envia la invitació de marca
  // via Resend (email best-effort). Després completem telèfon i fila de client.
  const profileId = await createUserWithInvite({
    email: input.email,
    fullName: input.fullName,
    role: "client",
  });
  const admin = createAdminClient();
  await admin.from("profiles").update({ phone: input.phone }).eq("id", profileId);
  const { data: clientRow, error: insErr } = await admin
    .from("clients")
    .insert({
      profile_id: profileId,
      assigned_trainer_id: input.assignedTrainerId,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (insErr || !clientRow) {
    throw new Error(insErr?.message ?? "No s'ha pogut crear el client.");
  }
  return clientRow.id;
}

/** Actualiza los datos de un cliente existente. */
export async function updateClientRecord(
  id: string,
  input: ClientInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.id === id);
    if (!client) throw new Error("Client no trobat");
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

  // Real: actualizamos la fila de cliente y su perfil (RLS deja al admin).
  const supabase = await createClient();
  const { data: client, error: getErr } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", id)
    .single();
  if (getErr || !client) throw new Error("Client no trobat");

  const { error: cErr } = await supabase
    .from("clients")
    .update({
      assigned_trainer_id: input.assignedTrainerId,
      notes: input.notes,
    })
    .eq("id", id);
  if (cErr) throw cErr;

  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
    })
    .eq("id", client.profile_id);
  if (pErr) throw pErr;
}

// ── Ajustes del propio perfil (área cliente · Configuració) ──

export type ProfileSettings = {
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: PreferredLanguage;
  birthDate: string; // YYYY-MM-DD o ""
  heightCm: string; // string para el input numérico
  weightKg: string;
  gender: Gender | "";
  emergencyContact: string;
  objective: string;
};

/** Lee los datos editables del propio perfil. */
export async function getProfileSettings(
  profileId: string,
): Promise<ProfileSettings | null> {
  const toSettings = (p: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    preferred_language: PreferredLanguage;
    birth_date: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    gender: Gender | null;
    emergency_contact: string | null;
    objective: string | null;
  }): ProfileSettings => ({
    fullName: p.full_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    preferredLanguage: p.preferred_language,
    birthDate: p.birth_date ?? "",
    heightCm: p.height_cm != null ? String(p.height_cm) : "",
    weightKg: p.weight_kg != null ? String(p.weight_kg) : "",
    gender: p.gender ?? "",
    emergencyContact: p.emergency_contact ?? "",
    objective: p.objective ?? "",
  });

  if (USE_MOCK) {
    const p = getStore().profiles.find((x) => x.id === profileId);
    return p ? toSettings(p) : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "full_name, email, phone, preferred_language, birth_date, height_cm, weight_kg, gender, emergency_contact, objective",
    )
    .eq("id", profileId)
    .single();
  if (error || !data) return null;
  return toSettings(data);
}

export type ProfileSettingsInput = {
  fullName: string;
  phone: string | null;
  preferredLanguage: PreferredLanguage;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  gender: Gender | null;
  emergencyContact: string | null;
  objective: string | null;
};

/**
 * Actualiza el propio perfil. El email NO se toca porque es el de login. La RLS
 * de `profiles_update` solo deja modificar la propia fila (id = auth.uid());
 * aun así filtramos por `profileId`.
 */
export async function updateProfileSettings(
  profileId: string,
  input: ProfileSettingsInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const p = store.profiles.find((x) => x.id === profileId);
    if (!p) throw new Error("Perfil no trobat.");
    p.full_name = input.fullName;
    p.phone = input.phone;
    p.preferred_language = input.preferredLanguage;
    p.birth_date = input.birthDate;
    p.height_cm = input.heightCm;
    p.weight_kg = input.weightKg;
    p.gender = input.gender;
    p.emergency_contact = input.emergencyContact;
    p.objective = input.objective;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone,
      preferred_language: input.preferredLanguage,
      birth_date: input.birthDate,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      gender: input.gender,
      emergency_contact: input.emergencyContact,
      objective: input.objective,
    })
    .eq("id", profileId);
  if (error) throw error;
}
