import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { listTrainers } from "@/lib/data/clients";
import { listAvailabilityLite } from "@/lib/data/availability";
import { isServiceAvailable } from "@/lib/availability-slots";
import { mockActiveHoldsAt, fetchActiveHoldsAt } from "@/lib/data/trial-bookings";
import { notify, getProfileContact } from "@/lib/notifications";
import { GROUP_CAPACITY, SERVICE_LABELS } from "@/lib/labels";
import type { Database, ServiceType, ReservationStatus } from "@/types/database";

/** Lanza si la franja no cae dentro de la disponibilidad del trainer para el servicio. */
async function assertWithinAvailability(
  trainerId: string,
  when: Date,
  serviceType: ServiceType,
): Promise<void> {
  const rules = await listAvailabilityLite(trainerId);
  if (!isServiceAvailable(rules, when, when.getHours(), serviceType))
    throw new Error(
      "Aquesta franja no està dins de la disponibilitat d'aquest professional per a aquest servei.",
    );
}

type DB = SupabaseClient<Database>;

// ─────────────── Notificacions (best-effort) ───────────────

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type Contact = {
  profileId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
};

/** Contacte del client (perfil) a partir del client_id. */
async function clientContact(clientId: string): Promise<Contact | null> {
  if (USE_MOCK) {
    const store = getStore();
    const cl = store.clients.find((c) => c.id === clientId);
    if (!cl) return null;
    const p = store.profiles.find((x) => x.id === cl.profile_id);
    return {
      profileId: cl.profile_id,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      name: p?.full_name ?? null,
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select(
      "profile_id, profile:profiles!clients_profile_id_fkey(email, phone, full_name)",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  const p = (
    data as unknown as {
      profile: { email: string | null; phone: string | null; full_name: string | null } | null;
    }
  ).profile;
  return {
    profileId: data.profile_id as string,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    name: p?.full_name ?? null,
  };
}

/** Notifica al client una reserva creada/cancel·lada (best-effort). */
async function notifyReservation(
  clientId: string,
  type: "reservation_confirmed" | "reservation_cancelled",
  info: {
    reservationId?: string | null;
    scheduledAt: string;
    serviceType: ServiceType;
    trainerName?: string | null;
  },
): Promise<void> {
  const c = await clientContact(clientId);
  if (!c) return;
  await notify({
    type,
    recipient: c,
    relatedId: info.reservationId ?? null,
    data: {
      name: c.name ?? "",
      when: fmtWhen(info.scheduledAt),
      service: SERVICE_LABELS[info.serviceType],
      ...(info.trainerName ? { trainer: info.trainerName } : {}),
    },
  });
}

/**
 * Avisa el PROFESSIONAL (dueño de la agenda) que un client li ha reservat o
 * cancel·lat una sessió. Només s'ha de cridar quan l'acció l'ha iniciat el
 * client (autoservei), mai quan l'ha fet el propi entrenador o l'admin.
 */
async function notifyTrainerBooking(
  trainerId: string,
  type: "trainer_booking_received" | "trainer_booking_cancelled",
  info: { clientName: string | null; scheduledAt: string; serviceType: ServiceType },
): Promise<void> {
  const t = await getProfileContact(trainerId);
  if (!t) return;
  await notify({
    type,
    recipient: t,
    data: {
      name: t.name ?? "",
      client: info.clientName ?? "Un client",
      when: fmtWhen(info.scheduledAt),
      service: SERVICE_LABELS[info.serviceType],
    },
  });
}

/** Avisa el client que li queda 1 sessió al bo (best-effort). */
async function notifyBonoLowIfNeeded(
  clientId: string,
  serviceType: ServiceType,
  remaining: number,
): Promise<void> {
  if (remaining !== 1) return;
  const c = await clientContact(clientId);
  if (!c) return;
  await notify({
    type: "bono_low",
    recipient: c,
    data: { name: c.name ?? "", service: SERVICE_LABELS[serviceType] },
  });
}

/**
 * Devuelve una sesión a su bono (al cancelar una reserva) y reactiva el bono si
 * estaba completado. Compartida entre la cancelación de trainer/admin y la del
 * cliente; funciona con cualquier cliente de Supabase (user-scoped o admin).
 */
async function restoreBonoSession(supabase: DB, bonoId: string): Promise<void> {
  const { data: bono } = await supabase
    .from("bonos")
    .select("remaining_sessions, total_sessions, status")
    .eq("id", bonoId)
    .single();
  if (!bono) return;
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
    .eq("id", bonoId);
}

/**
 * Comprueba que una franja del entrenador esté libre para el servicio dado.
 * Regla: no puede solaparse con otra reserva 'booked' del mismo trainer a la
 * misma hora, EXCEPTO 'grupo_reducido', que admite hasta GROUP_CAPACITY (y solo
 * si no hay ya una sesión individual ocupando la franja). Lanza si está ocupada.
 */
function assertSlotFree(
  existing: { service_type: ServiceType }[],
  newService: ServiceType,
): void {
  if (newService === "grupo_reducido") {
    const hasExclusive = existing.some(
      (e) => e.service_type !== "grupo_reducido",
    );
    if (hasExclusive) throw new Error("Aquesta franja ja està ocupada.");
    if (existing.length >= GROUP_CAPACITY)
      throw new Error("El grup d'aquesta franja ja està complet.");
  } else if (existing.length > 0) {
    throw new Error("Aquesta franja ja està ocupada.");
  }
}

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
    const trainerName = input.trainerId
      ? (store.profiles.find((p) => p.id === input.trainerId)?.full_name ?? null)
      : null;
    await notifyReservation(bono.client_id, "reservation_confirmed", {
      scheduledAt: dates[0],
      serviceType: bono.service_type,
      trainerName,
    });
    await notifyBonoLowIfNeeded(
      bono.client_id,
      bono.service_type,
      bono.remaining_sessions,
    );
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

  const trainer = input.trainerId
    ? await getProfileContact(input.trainerId)
    : null;
  await notifyReservation(bono.client_id, "reservation_confirmed", {
    scheduledAt: dates[0],
    serviceType: bono.service_type,
    trainerName: trainer?.name ?? null,
  });
  await notifyBonoLowIfNeeded(bono.client_id, bono.service_type, remaining);
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
    await notifyReservation(r.client_id, "reservation_cancelled", {
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
    });
    return;
  }

  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("reservations")
    .select("id, status, bono_id, client_id, scheduled_at, service_type")
    .eq("id", id)
    .single();
  if (error || !r) throw new Error("Reserva no trobada.");
  if (r.status !== "booked") return;

  const { error: uErr } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (uErr) throw uErr;

  if (r.bono_id) await restoreBonoSession(supabase, r.bono_id);
  await notifyReservation(r.client_id, "reservation_cancelled", {
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
  });
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

/** Reprograma una reserva (cambia la fecha/hora). Solo si está reservada. */
export async function rescheduleReservation(
  id: string,
  scheduledAt: string,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find((x) => x.id === id);
    if (!r) throw new Error("Reserva no trobada.");
    if (r.status !== "booked")
      throw new Error("Només es poden reprogramar reserves actives.");
    r.scheduled_at = scheduledAt;
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ scheduled_at: scheduledAt })
    .eq("id", id)
    .eq("status", "booked");
  if (error) throw error;
}

// ──────────────── Autonomía del cliente (self-service) ────────────────
//
// El rol `client` no tiene RLS de escritura sobre reservations/bonos (no sería
// seguro: la RLS no puede forzar "descuenta exactamente 1"). Por eso estas
// acciones validan TODA la lógica de negocio en el servidor y escriben con el
// cliente service_role (createAdminClient). El cliente nunca controla el valor
// del bono.

export type ClientReservationInput = {
  profileId: string; // id del perfil del cliente (viewer.id)
  trainerId: string; // profesional dueño del slot elegido
  serviceType: ServiceType; // servicio del slot elegido
  scheduledAt: string; // ISO
};

/**
 * Reserva creada por el propio cliente. Lo que determina qué puede reservar es
 * el TIPO DE BONO, no el entrenador asignado: puede reservar con CUALQUIER
 * profesional cuya disponibilidad ofrezca un servicio para el que tenga bono
 * activo. Si tiene varios bonos activos de ese tipo, se consume el más antiguo
 * (FIFO por purchased_at).
 */
export async function createClientReservation(
  input: ClientReservationInput,
): Promise<void> {
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Data no vàlida.");
  if (when.getTime() <= Date.now())
    throw new Error("La data ha de ser futura.");
  const scheduledAt = when.toISOString();
  const { trainerId, serviceType } = input;

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("Client no trobat.");
    const bono = store.bonos
      .filter(
        (b) =>
          b.client_id === client.id &&
          b.service_type === serviceType &&
          b.status === "active" &&
          b.remaining_sessions > 0,
      )
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))[0];
    if (!bono)
      throw new Error("No tens cap bo actiu d'aquest tipus amb sessions.");
    await assertWithinAvailability(trainerId, when, serviceType);
    assertSlotFree(
      [
        ...store.reservations
          .filter(
            (r) =>
              r.trainer_id === trainerId &&
              r.scheduled_at === scheduledAt &&
              r.status === "booked",
          )
          .map((r) => ({ service_type: r.service_type })),
        // Les proves 'pending'/'confirmed' també ocupen el forat.
        ...mockActiveHoldsAt(store, trainerId, scheduledAt),
      ],
      serviceType,
    );
    store.reservations.push({
      id: crypto.randomUUID(),
      client_id: client.id,
      bono_id: bono.id,
      trainer_id: trainerId,
      scheduled_at: scheduledAt,
      service_type: serviceType,
      status: "booked",
      created_at: new Date().toISOString(),
    });
    bono.remaining_sessions -= 1;
    if (bono.remaining_sessions === 0) bono.status = "completed";
    saveStore(store);
    const trainerName =
      store.profiles.find((p) => p.id === trainerId)?.full_name ?? null;
    await notifyReservation(client.id, "reservation_confirmed", {
      scheduledAt,
      serviceType,
      trainerName,
    });
    await notifyBonoLowIfNeeded(client.id, serviceType, bono.remaining_sessions);
    // L'acció l'ha fet el client → avisa el professional de la nova reserva.
    const clientName =
      store.profiles.find((p) => p.id === input.profileId)?.full_name ?? null;
    await notifyTrainerBooking(trainerId, "trainer_booking_received", {
      clientName,
      scheduledAt,
      serviceType,
    });
    return;
  }

  const admin = createAdminClient();

  // 1. Cliente.
  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", input.profileId)
    .single();
  if (cErr || !client) throw new Error("Client no trobat.");

  // 2. La franja debe estar dentro de la disponibilidad de ESE profesional para
  //    ESE servicio.
  await assertWithinAvailability(trainerId, when, serviceType);

  // 3. Bono más antiguo activo de este tipo con sesiones (FIFO).
  const { data: bono, error: bErr } = await admin
    .from("bonos")
    .select("id, remaining_sessions")
    .eq("client_id", client.id)
    .eq("service_type", serviceType)
    .eq("status", "active")
    .gt("remaining_sessions", 0)
    .order("purchased_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!bono)
    throw new Error("No tens cap bo actiu d'aquest tipus amb sessions.");

  // 4. La franja del profesional no puede solaparse (salvo grupo con aforo).
  const { data: existing, error: eErr } = await admin
    .from("reservations")
    .select("service_type")
    .eq("trainer_id", trainerId)
    .eq("scheduled_at", scheduledAt)
    .eq("status", "booked");
  if (eErr) throw eErr;
  // Les proves 'pending'/'confirmed' també ocupen el forat.
  const holds = await fetchActiveHoldsAt(admin, trainerId, scheduledAt);
  assertSlotFree(
    [...((existing ?? []) as { service_type: ServiceType }[]), ...holds],
    serviceType,
  );

  // 5. Reclamo atómico de la sesión (decrement-first con bloqueo optimista).
  const nextRemaining = bono.remaining_sessions - 1;
  const { data: claimed, error: dErr } = await admin
    .from("bonos")
    .update({
      remaining_sessions: nextRemaining,
      ...(nextRemaining === 0 ? { status: "completed" as const } : {}),
    })
    .eq("id", bono.id)
    .eq("remaining_sessions", bono.remaining_sessions)
    .select("id")
    .single();
  if (dErr || !claimed)
    throw new Error("Aquest bo no té sessions disponibles.");

  // 6. Inserta la reserva; si falla, devuelve la sesión reclamada.
  const { error: rErr } = await admin.from("reservations").insert({
    client_id: client.id,
    bono_id: bono.id,
    trainer_id: trainerId,
    scheduled_at: scheduledAt,
    service_type: serviceType,
    status: "booked",
  });
  if (rErr) {
    await admin
      .from("bonos")
      .update({ remaining_sessions: bono.remaining_sessions, status: "active" })
      .eq("id", bono.id);
    throw new Error("Aquesta franja ja està ocupada.");
  }

  const trainer = await getProfileContact(trainerId);
  await notifyReservation(client.id, "reservation_confirmed", {
    scheduledAt,
    serviceType,
    trainerName: trainer?.name ?? null,
  });
  await notifyBonoLowIfNeeded(client.id, serviceType, nextRemaining);
  // L'acció l'ha fet el client → avisa el professional de la nova reserva.
  const me = await getProfileContact(input.profileId);
  await notifyTrainerBooking(trainerId, "trainer_booking_received", {
    clientName: me?.name ?? null,
    scheduledAt,
    serviceType,
  });
}

/** Cancelación de una reserva por el propio cliente (futura y 'booked'). */
export async function cancelClientReservation(
  profileId: string,
  reservationId: string,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find((x) => x.id === reservationId);
    if (!r) throw new Error("Reserva no trobada.");
    const client = store.clients.find((c) => c.id === r.client_id);
    if (!client || client.profile_id !== profileId)
      throw new Error("Aquesta reserva no és teva.");
    if (r.status !== "booked")
      throw new Error("Només pots cancel·lar reserves actives.");
    if (new Date(r.scheduled_at).getTime() <= Date.now())
      throw new Error("No pots cancel·lar una sessió passada.");
    const { getCenterSettings } = await import("@/lib/data/center-settings");
    const settings = await getCenterSettings();
    const minMs = settings.minCancellationHours * 60 * 60 * 1000;
    if (new Date(r.scheduled_at).getTime() - Date.now() < minMs)
      throw new Error(
        `Aquesta reserva ja no es pot cancel·lar (cal fer-ho amb almenys ${settings.minCancellationHours} hores d'antelació). Contacta amb el centre si tens una urgència.`,
      );
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
    // L'acció l'ha fet el client → avisa el professional de la cancel·lació.
    if (r.trainer_id) {
      const clientName =
        store.profiles.find((p) => p.id === client.profile_id)?.full_name ?? null;
      await notifyTrainerBooking(r.trainer_id, "trainer_booking_cancelled", {
        clientName,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
      });
    }
    return;
  }

  const admin = createAdminClient();
  const { data: r, error } = await admin
    .from("reservations")
    .select(
      `id, status, scheduled_at, service_type, trainer_id, bono_id,
       client:clients!reservations_client_id_fkey(profile_id, profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .eq("id", reservationId)
    .single();
  if (error || !r) throw new Error("Reserva no trobada.");
  const owner = (
    r as unknown as {
      client: { profile_id: string; profile: { full_name: string | null } | null } | null;
    }
  ).client;
  if (!owner || owner.profile_id !== profileId)
    throw new Error("Aquesta reserva no és teva.");
  if (r.status !== "booked")
    throw new Error("Només pots cancel·lar reserves actives.");
  if (new Date(r.scheduled_at).getTime() <= Date.now())
    throw new Error("No pots cancel·lar una sessió passada.");
  const { getCenterSettings } = await import("@/lib/data/center-settings");
  const settings = await getCenterSettings();
  const minMs = settings.minCancellationHours * 60 * 60 * 1000;
  if (new Date(r.scheduled_at).getTime() - Date.now() < minMs)
    throw new Error(
      `Aquesta reserva ja no es pot cancel·lar (cal fer-ho amb almenys ${settings.minCancellationHours} hores d'antelació). Contacta amb el centre si tens una urgència.`,
    );

  const { error: uErr } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId);
  if (uErr) throw uErr;
  if (r.bono_id) await restoreBonoSession(admin, r.bono_id);
  // L'acció l'ha fet el client → avisa el professional de la cancel·lació.
  if (r.trainer_id)
    await notifyTrainerBooking(r.trainer_id, "trainer_booking_cancelled", {
      clientName: owner.profile?.full_name ?? null,
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
    });
}

/** Reserva para el calendario del cliente: SIN nombres de otros clientes. */
export type ClientCalendarReservation = {
  id: string;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  isOwn: boolean;
};

export type ClientReservationData = {
  clientId: string | null;
  trainerId: string | null;
  trainerName: string | null;
  bonos: { id: string; serviceType: ServiceType; remaining: number }[];
  reservations: ClientCalendarReservation[];
};

/**
 * Datos para la página de reservas del cliente: sus bonos activos y la agenda
 * de su entrenador asignado. Las reservas de otros clientes llegan SIN nombre
 * (la anonimización se hace aquí, en el servidor, vía service_role).
 */
export async function getClientReservationData(
  profileId: string,
): Promise<ClientReservationData> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    if (!client)
      return {
        clientId: null,
        trainerId: null,
        trainerName: null,
        bonos: [],
        reservations: [],
      };
    const trainerId = client.assigned_trainer_id;
    const trainerName = trainerId
      ? (store.profiles.find((p) => p.id === trainerId)?.full_name ?? null)
      : null;
    const bonos = store.bonos
      .filter(
        (b) =>
          b.client_id === client.id &&
          b.status === "active" &&
          b.remaining_sessions > 0,
      )
      .map((b) => ({
        id: b.id,
        serviceType: b.service_type,
        remaining: b.remaining_sessions,
      }));
    const reservations = store.reservations
      .filter((r) => r.trainer_id === trainerId && r.status !== "cancelled")
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
        isOwn: r.client_id === client.id,
      }));
    return { clientId: client.id, trainerId, trainerName, bonos, reservations };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, assigned_trainer_id")
    .eq("profile_id", profileId)
    .single();
  if (!client)
    return {
      clientId: null,
      trainerId: null,
      trainerName: null,
      bonos: [],
      reservations: [],
    };

  const trainerId = client.assigned_trainer_id;
  const { data: bonoRows } = await admin
    .from("bonos")
    .select("id, service_type, remaining_sessions, status")
    .eq("client_id", client.id);
  const bonos = (bonoRows ?? [])
    .filter((b) => b.status === "active" && b.remaining_sessions > 0)
    .map((b) => ({
      id: b.id,
      serviceType: b.service_type,
      remaining: b.remaining_sessions,
    }));

  let trainerName: string | null = null;
  let reservations: ClientCalendarReservation[] = [];
  if (trainerId) {
    const { data: tp } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", trainerId)
      .single();
    trainerName = tp?.full_name ?? null;

    const { data: res } = await admin
      .from("reservations")
      .select("id, client_id, scheduled_at, service_type, status")
      .eq("trainer_id", trainerId)
      .neq("status", "cancelled");
    reservations = (res ?? []).map((r) => ({
      id: r.id,
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
      status: r.status,
      isOwn: r.client_id === client.id,
    }));
  }

  return { clientId: client.id, trainerId, trainerName, bonos, reservations };
}
