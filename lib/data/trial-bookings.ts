import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { CENTER_EMAIL } from "@/lib/email";
import { notify, getProfileContact } from "@/lib/notifications";
import {
  isServiceAvailable,
  localDateStr,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import { TRIAL_SERVICE, TRAINING_SERVICES } from "@/lib/data/trial-bookings.constants";
import type { Database, ServiceType, TrialStatus } from "@/types/database";

type DB = SupabaseClient<Database>;
type TrialRow = Database["public"]["Tables"]["trial_bookings"]["Row"];

export { TRIAL_SERVICE, TRAINING_SERVICES };

const HOUR = 60 * 60 * 1000;

/** Format llegible d'una data/hora en català. */
function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Avisa el professional del forat i el correu del centre (esdeveniment trial_request). */
async function notifyTrialRequested(input: {
  trainerId: string | null;
  fullName: string;
  email: string;
  phone: string;
  scheduledAt: string;
}): Promise<void> {
  const when = fmtWhen(input.scheduledAt);
  const data = {
    visitorName: input.fullName,
    when,
    phone: input.phone,
    email: input.email,
  };
  // Al professional dueño del forat (segons les seves preferències).
  if (input.trainerId) {
    const trainer = await getProfileContact(input.trainerId);
    if (trainer)
      await notify({
        type: "trial_request",
        recipient: { profileId: trainer.profileId, email: trainer.email, phone: trainer.phone, name: trainer.name },
        data: { ...data, name: trainer.name ?? "" },
      });
  }
  // Al correu general del centre (operatiu: ignora preferències d'usuari).
  if (CENTER_EMAIL)
    await notify(
      {
        type: "trial_request",
        recipient: { profileId: null, email: CENTER_EMAIL, phone: null, name: "Centre" },
        data: { ...data, name: "" },
      },
      { ignorePreferences: true },
    );
}
const MIN_ADVANCE_MS = 24 * HOUR;
const MAX_ADVANCE_MS = 30 * 24 * HOUR;
const IP_MAX_PER_HOUR = 3;

/**
 * Caducitat d'una prova: fins quan l'entrenador pot acceptar-la. És el mínim
 * entre 24 h des de la creació i la meitat del temps que falta fins a la
 * sessió (una sessió imminent caduca abans, per no bloquejar el forat gaire).
 */
export function computeTrialExpiry(createdAtMs: number, scheduledAtMs: number): string {
  const in24h = createdAtMs + MIN_ADVANCE_MS;
  const half = createdAtMs + Math.floor((scheduledAtMs - createdAtMs) / 2);
  return new Date(Math.min(in24h, half)).toISOString();
}

/** ¿La prova bloqueja el forat ara mateix? (pendent no caducada o confirmada) */
function isActiveHold(t: Pick<TrialRow, "status" | "expires_at">, nowMs: number): boolean {
  if (t.status === "confirmed") return true;
  if (t.status === "pending") return new Date(t.expires_at).getTime() >= nowMs;
  return false;
}

// ─────────────── Caducitat peresosa (oportunista) ───────────────

/** Marca com 'expired' les proves pendents ja caducades (mock). */
function sweepExpiredMock(store: Store): boolean {
  const now = Date.now();
  let changed = false;
  for (const t of store.trial_bookings) {
    if (t.status === "pending" && new Date(t.expires_at).getTime() < now) {
      t.status = "expired";
      changed = true;
    }
  }
  return changed;
}

/** Marca com 'expired' les proves pendents ja caducades (real). */
async function sweepExpiredReal(admin: DB): Promise<void> {
  await admin
    .from("trial_bookings")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
}

// ─────────────── Holds que ocupen un forat (per a reservations) ───────────────

/** Proves que ocupen (trainer, scheduled_at) exacte, al store mock. */
export function mockActiveHoldsAt(
  store: Store,
  trainerId: string,
  scheduledAtISO: string,
): { service_type: ServiceType }[] {
  const now = Date.now();
  return store.trial_bookings
    .filter(
      (t) =>
        t.trainer_id === trainerId &&
        t.scheduled_at === scheduledAtISO &&
        isActiveHold(t, now),
    )
    .map((t) => ({ service_type: t.service_type }));
}

/** Proves que ocupen (trainer, scheduled_at) exacte, al backend real. */
export async function fetchActiveHoldsAt(
  admin: DB,
  trainerId: string,
  scheduledAtISO: string,
): Promise<{ service_type: ServiceType }[]> {
  const now = new Date().toISOString();
  const { data } = await admin
    .from("trial_bookings")
    .select("service_type, status, expires_at")
    .eq("trainer_id", trainerId)
    .eq("scheduled_at", scheduledAtISO)
    .in("status", ["pending", "confirmed"]);
  return (data ?? [])
    .filter((t) => t.status === "confirmed" || t.expires_at >= now)
    .map((t) => ({ service_type: t.service_type }));
}

// ─────────────── Dades públiques per a /prova ───────────────

export type PublicTrialData = {
  /** Regles d'entrenament (només serveis d'entrenament) de tots els entrenadors. */
  rules: TrainerRuleLite[];
  /** Claus `${trainerId}|${YYYY-MM-DD}|${hour}` de forats ja ocupats. */
  busy: string[];
};

/**
 * Disponibilitat pública per a la sessió de prova: NOMÉS forats lliures. No
 * s'exposa cap nom, tipus ni ocupació; el visitant només veu QUÈ està lliure.
 * La ocupació combina reserves 'booked' i proves actives (pending/confirmed).
 */
export async function getPublicTrialData(): Promise<PublicTrialData> {
  const allRules = await listAllTrainerRulesLite();
  // Només regles que ofereixen com a mínim el servei de prova (ep_individual).
  const rules = allRules
    .filter((r) => r.serviceTypes.includes(TRIAL_SERVICE))
    .map((r) => ({
      ...r,
      serviceTypes: r.serviceTypes.filter((s) =>
        (TRAINING_SERVICES as ServiceType[]).includes(s),
      ),
    }));

  const busy = new Set<string>();
  const addBusy = (trainerId: string | null, iso: string) => {
    if (!trainerId) return;
    const d = new Date(iso);
    busy.add(`${trainerId}|${localDateStr(d)}|${d.getHours()}`);
  };

  if (USE_MOCK) {
    const store = getStore();
    const now = Date.now();
    for (const r of store.reservations)
      if (r.status === "booked") addBusy(r.trainer_id, r.scheduled_at);
    for (const t of store.trial_bookings)
      if (isActiveHold(t, now)) addBusy(t.trainer_id, t.scheduled_at);
    return { rules, busy: [...busy] };
  }

  const admin = createAdminClient();
  await sweepExpiredReal(admin);
  const [res, trials] = await Promise.all([
    admin
      .from("reservations")
      .select("trainer_id, scheduled_at")
      .eq("status", "booked"),
    admin
      .from("trial_bookings")
      .select("trainer_id, scheduled_at, status, expires_at")
      .in("status", ["pending", "confirmed"]),
  ]);
  const nowISO = new Date().toISOString();
  for (const r of res.data ?? []) addBusy(r.trainer_id, r.scheduled_at);
  for (const t of trials.data ?? [])
    if (t.status === "confirmed" || t.expires_at >= nowISO)
      addBusy(t.trainer_id, t.scheduled_at);
  return { rules, busy: [...busy] };
}

// ─────────────── Crear una sol·licitud de prova ───────────────

export type CreateTrialInput = {
  fullName: string;
  email: string;
  phone: string;
  scheduledAt: string; // ISO
  ip: string | null;
};

/** Tria un entrenador lliure que ofereixi la prova en aquell forat. */
function pickTrainer(
  rules: TrainerRuleLite[],
  when: Date,
  isFree: (trainerId: string) => boolean,
): string | null {
  const candidates = rules
    .filter((r) => r.serviceTypes.includes(TRIAL_SERVICE))
    .map((r) => r.trainerId);
  for (const trainerId of new Set(candidates)) {
    if (!isFree(trainerId)) continue;
    const trainerRules = rules.filter((r) => r.trainerId === trainerId);
    if (isServiceAvailable(trainerRules, when, when.getHours(), TRIAL_SERVICE))
      return trainerId;
  }
  return null;
}

/**
 * Crea una sol·licitud de prova en estat 'pending'. Valida TOTA la lògica al
 * servidor (mai confiar en el client): finestra 24 h–30 dies, antiabús per
 * email/telèfon i IP, disponibilitat real i no-solapament. Assigna un
 * entrenador lliure automàticament (el visitant no tria professional).
 */
export async function createTrialBooking(input: CreateTrialInput): Promise<void> {
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Data no vàlida.");
  const nowMs = Date.now();
  const delta = when.getTime() - nowMs;
  if (delta < MIN_ADVANCE_MS)
    throw new Error("Cal demanar la prova amb un mínim de 24 h d'antelació.");
  if (delta > MAX_ADVANCE_MS)
    throw new Error("Només es poden demanar proves fins a 30 dies vista.");

  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const scheduledAt = when.toISOString();
  const expiresAt = computeTrialExpiry(nowMs, when.getTime());
  const rules = (await listAllTrainerRulesLite()).filter((r) =>
    r.serviceTypes.includes(TRIAL_SERVICE),
  );

  if (USE_MOCK) {
    const store = getStore();
    sweepExpiredMock(store);
    assertNoDuplicateMock(store, email, phone);
    assertIpRateMock(store, input.ip, nowMs);
    const trainerId = pickTrainer(rules, when, (tid) =>
      isTrainerFreeMock(store, tid, scheduledAt),
    );
    if (!trainerId)
      throw new Error("Aquest horari ja no està disponible. Tria'n un altre.");
    store.trial_bookings.push({
      id: crypto.randomUUID(),
      full_name: input.fullName.trim(),
      email,
      phone,
      trainer_id: trainerId,
      scheduled_at: scheduledAt,
      service_type: TRIAL_SERVICE,
      status: "pending",
      expires_at: expiresAt,
      converted_client_id: null,
      consent_privacy_at: new Date().toISOString(),
      ip: input.ip,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    await notifyTrialRequested({
      trainerId,
      fullName: input.fullName.trim(),
      email,
      phone,
      scheduledAt,
    });
    return;
  }

  const admin = createAdminClient();
  await sweepExpiredReal(admin);

  // Antiabús: email/telèfon amb una prova viva (pending viva/confirmed/completed).
  const nowISO = new Date().toISOString();
  const { data: dup } = await admin
    .from("trial_bookings")
    .select("id, status, expires_at, email, phone")
    .in("status", ["pending", "confirmed", "completed"])
    .or(`email.eq.${email},phone.eq.${phone}`);
  const alive = (dup ?? []).filter(
    (t) => t.status !== "pending" || t.expires_at >= nowISO,
  );
  if (alive.length > 0)
    throw new Error(
      "Ja tens una sessió de prova sol·licitada amb aquestes dades.",
    );

  // Rate limit per IP: màxim 3 en l'última hora.
  if (input.ip) {
    const since = new Date(nowMs - HOUR).toISOString();
    const { count } = await admin
      .from("trial_bookings")
      .select("id", { count: "exact", head: true })
      .eq("ip", input.ip)
      .gte("created_at", since);
    if ((count ?? 0) >= IP_MAX_PER_HOUR)
      throw new Error("Has fet massa sol·licituds. Torna-ho a provar més tard.");
  }

  const trainerId = pickTrainer(rules, when, () => true);
  // Comprova de nou que el candidat estigui realment lliure (reserva + hold).
  let chosen: string | null = null;
  if (trainerId) {
    chosen = (await isTrainerFreeReal(admin, trainerId, scheduledAt))
      ? trainerId
      : null;
  }
  if (!chosen) {
    // Cerca qualsevol altre lliure.
    for (const tid of new Set(rules.map((r) => r.trainerId))) {
      const trainerRules = rules.filter((r) => r.trainerId === tid);
      if (
        isServiceAvailable(trainerRules, when, when.getHours(), TRIAL_SERVICE) &&
        (await isTrainerFreeReal(admin, tid, scheduledAt))
      ) {
        chosen = tid;
        break;
      }
    }
  }
  if (!chosen)
    throw new Error("Aquest horari ja no està disponible. Tria'n un altre.");

  const { error } = await admin.from("trial_bookings").insert({
    full_name: input.fullName.trim(),
    email,
    phone,
    trainer_id: chosen,
    scheduled_at: scheduledAt,
    service_type: TRIAL_SERVICE,
    status: "pending",
    expires_at: expiresAt,
    consent_privacy_at: new Date().toISOString(),
    ip: input.ip,
  });
  if (error) throw error;
  await notifyTrialRequested({
    trainerId: chosen,
    fullName: input.fullName.trim(),
    email,
    phone,
    scheduledAt,
  });
}

function assertNoDuplicateMock(store: Store, email: string, phone: string): void {
  const now = Date.now();
  const alive = store.trial_bookings.filter((t) => {
    const counts =
      t.status === "confirmed" ||
      t.status === "completed" ||
      (t.status === "pending" && new Date(t.expires_at).getTime() >= now);
    return counts && (t.email === email || t.phone === phone);
  });
  if (alive.length > 0)
    throw new Error("Ja tens una sessió de prova sol·licitada amb aquestes dades.");
}

function assertIpRateMock(store: Store, ip: string | null, nowMs: number): void {
  if (!ip) return;
  const since = nowMs - HOUR;
  const recent = store.trial_bookings.filter(
    (t) => t.ip === ip && new Date(t.created_at).getTime() >= since,
  );
  if (recent.length >= IP_MAX_PER_HOUR)
    throw new Error("Has fet massa sol·licituds. Torna-ho a provar més tard.");
}

function isTrainerFreeMock(store: Store, trainerId: string, scheduledAt: string): boolean {
  const reserved = store.reservations.some(
    (r) =>
      r.trainer_id === trainerId &&
      r.scheduled_at === scheduledAt &&
      r.status === "booked",
  );
  if (reserved) return false;
  const now = Date.now();
  const held = store.trial_bookings.some(
    (t) =>
      t.trainer_id === trainerId &&
      t.scheduled_at === scheduledAt &&
      isActiveHold(t, now),
  );
  return !held;
}

async function isTrainerFreeReal(admin: DB, trainerId: string, scheduledAt: string): Promise<boolean> {
  const { data: res } = await admin
    .from("reservations")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("scheduled_at", scheduledAt)
    .eq("status", "booked")
    .limit(1);
  if ((res ?? []).length > 0) return false;
  const holds = await fetchActiveHoldsAt(admin, trainerId, scheduledAt);
  return holds.length === 0;
}

// ─────────────── Llistat i gestió interna ───────────────

export type TrialBookingItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  trainerId: string | null;
  trainerName: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: TrialStatus;
  expiresAt: string;
  convertedClientId: string | null;
  createdAt: string;
};

/** Llista de proves (opcionalment només d'un entrenador). Aplica caducitat. */
export async function listTrialBookings(
  trainerId?: string,
): Promise<TrialBookingItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    if (sweepExpiredMock(store)) saveStore(store);
    const nameOf = (id: string | null) =>
      id ? (store.profiles.find((p) => p.id === id)?.full_name ?? null) : null;
    return store.trial_bookings
      .filter((t) => !trainerId || t.trainer_id === trainerId)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .map((t) => ({
        id: t.id,
        fullName: t.full_name,
        email: t.email,
        phone: t.phone,
        trainerId: t.trainer_id,
        trainerName: nameOf(t.trainer_id),
        scheduledAt: t.scheduled_at,
        serviceType: t.service_type,
        status: t.status,
        expiresAt: t.expires_at,
        convertedClientId: t.converted_client_id,
        createdAt: t.created_at,
      }));
  }

  const admin = createAdminClient();
  await sweepExpiredReal(admin);
  let query = admin
    .from("trial_bookings")
    .select(
      "id, full_name, email, phone, trainer_id, scheduled_at, service_type, status, expires_at, converted_client_id, created_at, trainer:profiles!trial_bookings_trainer_id_fkey(full_name)",
    )
    .order("scheduled_at", { ascending: true });
  if (trainerId) query = query.eq("trainer_id", trainerId);
  const { data, error } = await query;
  if (error) throw error;
  type Row = TrialRow & { trainer: { full_name: string | null } | null };
  return (data as unknown as Row[]).map((t) => ({
    id: t.id,
    fullName: t.full_name,
    email: t.email,
    phone: t.phone,
    trainerId: t.trainer_id,
    trainerName: t.trainer?.full_name ?? null,
    scheduledAt: t.scheduled_at,
    serviceType: t.service_type,
    status: t.status,
    expiresAt: t.expires_at,
    convertedClientId: t.converted_client_id,
    createdAt: t.created_at,
  }));
}

/** Proves actives (pending viva/confirmed) per pintar als calendaris interns. */
export type TrialHoldItem = {
  id: string;
  fullName: string;
  phone: string;
  trainerId: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: TrialStatus; // 'pending' | 'confirmed'
};

export async function listActiveTrialHolds(
  trainerId?: string,
): Promise<TrialHoldItem[]> {
  const all = await listTrialBookings(trainerId);
  return all
    .filter((t) => t.status === "pending" || t.status === "confirmed")
    .map((t) => ({
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      trainerId: t.trainerId,
      scheduledAt: t.scheduledAt,
      serviceType: t.serviceType,
      status: t.status,
    }));
}

/** Comprova (real/mock) que qui actua pot gestionar la prova. */
async function updateTrialStatus(
  id: string,
  next: TrialStatus,
  actingTrainerId: string | null,
  fromStatuses?: TrialStatus[],
): Promise<TrialBookingItem | null> {
  if (USE_MOCK) {
    const store = getStore();
    const t = store.trial_bookings.find((x) => x.id === id);
    if (!t) throw new Error("Sol·licitud no trobada.");
    if (actingTrainerId && t.trainer_id !== actingTrainerId)
      throw new Error("Aquesta sol·licitud no és teva.");
    if (fromStatuses && !fromStatuses.includes(t.status))
      throw new Error("Aquesta sol·licitud ja no es pot canviar.");
    t.status = next;
    saveStore(store);
    return null;
  }
  const admin = createAdminClient();
  const { data: t } = await admin
    .from("trial_bookings")
    .select("id, trainer_id, status")
    .eq("id", id)
    .single();
  if (!t) throw new Error("Sol·licitud no trobada.");
  if (actingTrainerId && t.trainer_id !== actingTrainerId)
    throw new Error("Aquesta sol·licitud no és teva.");
  if (fromStatuses && !fromStatuses.includes(t.status))
    throw new Error("Aquesta sol·licitud ja no es pot canviar.");
  const { error } = await admin
    .from("trial_bookings")
    .update({ status: next })
    .eq("id", id);
  if (error) throw error;
  return null;
}

/** Notifica el visitant del canvi d'estat de la seva prova (trial_status). */
async function notifyTrialStatus(id: string, status: "confirmed" | "rejected"): Promise<void> {
  const t = (await listTrialBookings()).find((x) => x.id === id);
  if (!t) return;
  await notify({
    type: "trial_status",
    recipient: { profileId: null, email: t.email, phone: t.phone, name: t.fullName },
    relatedId: t.id,
    data: { name: t.fullName, when: fmtWhen(t.scheduledAt), status },
  });
}

/** L'entrenador (o admin) accepta una prova pendent → 'confirmed'. */
export async function acceptTrial(id: string, actingTrainerId: string | null): Promise<void> {
  await updateTrialStatus(id, "confirmed", actingTrainerId, ["pending"]);
  await notifyTrialStatus(id, "confirmed");
}

/** Rebutja una prova pendent/confirmada → 'rejected' (allibera el forat). */
export async function rejectTrial(id: string, actingTrainerId: string | null): Promise<void> {
  await updateTrialStatus(id, "rejected", actingTrainerId, ["pending", "confirmed"]);
  await notifyTrialStatus(id, "rejected");
}

/** Estats de tancament que pot fixar l'admin (sense restricció d'entrenador). */
export async function setTrialFinalStatus(
  id: string,
  next: Extract<TrialStatus, "completed" | "no_show" | "cancelled">,
): Promise<void> {
  await updateTrialStatus(id, next, null);
}

/** Guarda a quin client s'ha convertit una prova. */
export async function markTrialConverted(id: string, clientId: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const t = store.trial_bookings.find((x) => x.id === id);
    if (t) {
      t.converted_client_id = clientId;
      if (t.status === "confirmed" || t.status === "pending") t.status = "completed";
      saveStore(store);
    }
    return;
  }
  const admin = createAdminClient();
  await admin
    .from("trial_bookings")
    .update({ converted_client_id: clientId, status: "completed" })
    .eq("id", id);
}

/** Dades d'una prova per prerellenar l'alta de client. */
export async function getTrialForConversion(
  id: string,
): Promise<{ fullName: string; email: string; phone: string; trainerId: string | null } | null> {
  const items = await listTrialBookings();
  const t = items.find((x) => x.id === id);
  if (!t) return null;
  return { fullName: t.fullName, email: t.email, phone: t.phone, trainerId: t.trainerId };
}

// ─────────────── RGPD ───────────────

/**
 * Elimina les proves d'un client (dret a l'oblit): les convertides (per
 * converted_client_id) i les que coincideixin amb el seu email/telèfon.
 */
export async function deleteTrialsForClient(input: {
  clientId: string;
  email: string | null;
  phone: string | null;
}): Promise<void> {
  const email = input.email?.trim().toLowerCase() ?? null;
  const phone = input.phone?.trim() ?? null;
  if (USE_MOCK) {
    const store = getStore();
    store.trial_bookings = store.trial_bookings.filter(
      (t) =>
        t.converted_client_id !== input.clientId &&
        (!email || t.email !== email) &&
        (!phone || t.phone !== phone),
    );
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  await admin
    .from("trial_bookings")
    .delete()
    .eq("converted_client_id", input.clientId);
  if (email)
    await admin.from("trial_bookings").delete().eq("email", email);
  if (phone)
    await admin.from("trial_bookings").delete().eq("phone", phone);
}
