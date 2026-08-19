import "server-only";
import { createHash } from "node:crypto";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getStore } from "@/lib/mock/store";
import { SERVICE_LABELS } from "@/lib/labels";
import type { NotificationRecipient } from "@/lib/notifications/types";
import type { ServiceType } from "@/types/database";

const TZ = "Europe/Madrid";

/** Hora local (HH:mm) a Europe/Madrid d'un instant ISO. */
function madridTime(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** UUID determinista a partir d'una cadena (per a l'idempotència del log). */
function stableUuid(s: string): string {
  const h = createHash("sha1").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Data local (YYYY-MM-DD) a Europe/Madrid d'un instant ISO. */
function madridDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** El dia de DEMÀ a Europe/Madrid, en YYYY-MM-DD. */
export function tomorrowMadrid(now = new Date()): string {
  return madridDay(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
}

export type ReminderTarget = {
  kind: "reservation" | "trial";
  relatedId: string;
  recipient: NotificationRecipient;
  scheduledAt: string;
  serviceType: ServiceType;
  trainerName: string | null;
};

/**
 * Reserves 'booked' i proves 'confirmed' del DIA SEGÜENT (Europe/Madrid), amb
 * el destinatari resolt, per enviar-los el recordatori.
 */
export async function listTomorrowReminderTargets(
  now = new Date(),
): Promise<ReminderTarget[]> {
  const target = tomorrowMadrid(now);
  const out: ReminderTarget[] = [];

  if (USE_MOCK) {
    const store = getStore();
    const nameOf = (id: string | null) =>
      id ? (store.profiles.find((p) => p.id === id)?.full_name ?? null) : null;
    for (const r of store.reservations) {
      if (r.status !== "booked") continue;
      if (madridDay(r.scheduled_at) !== target) continue;
      const cl = store.clients.find((c) => c.id === r.client_id);
      const p = cl && store.profiles.find((x) => x.id === cl.profile_id);
      if (!cl || !p) continue;
      out.push({
        kind: "reservation",
        relatedId: r.id,
        recipient: { profileId: p.id, email: p.email, phone: p.phone, name: p.full_name },
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        trainerName: nameOf(r.trainer_id),
      });
    }
    for (const t of store.trial_bookings) {
      if (t.status !== "confirmed") continue;
      if (madridDay(t.scheduled_at) !== target) continue;
      out.push({
        kind: "trial",
        relatedId: t.id,
        recipient: { profileId: null, email: t.email, phone: t.phone, name: t.full_name },
        scheduledAt: t.scheduled_at,
        serviceType: t.service_type,
        trainerName: nameOf(t.trainer_id),
      });
    }
    return out;
  }

  const admin = createAdminClient();
  const from = new Date(now.getTime()).toISOString();
  const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const [res, trials] = await Promise.all([
    admin
      .from("reservations")
      .select(
        "id, scheduled_at, service_type, trainer_id, client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(id, email, phone, full_name)), trainer:profiles!reservations_trainer_id_fkey(full_name)",
      )
      .eq("status", "booked")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
    admin
      .from("trial_bookings")
      .select("id, scheduled_at, service_type, full_name, email, phone, trainer_id, trainer:profiles!trial_bookings_trainer_id_fkey(full_name)")
      .eq("status", "confirmed")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
  ]);

  type ResRow = {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    client: { profile: { id: string; email: string | null; phone: string | null; full_name: string | null } | null } | null;
    trainer: { full_name: string | null } | null;
  };
  for (const r of (res.data as unknown as ResRow[]) ?? []) {
    if (madridDay(r.scheduled_at) !== target) continue;
    const p = r.client?.profile;
    if (!p) continue;
    out.push({
      kind: "reservation",
      relatedId: r.id,
      recipient: { profileId: p.id, email: p.email, phone: p.phone, name: p.full_name },
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
      trainerName: r.trainer?.full_name ?? null,
    });
  }
  type TrialRow = {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    full_name: string;
    email: string;
    phone: string;
    trainer: { full_name: string | null } | null;
  };
  for (const t of (trials.data as unknown as TrialRow[]) ?? []) {
    if (madridDay(t.scheduled_at) !== target) continue;
    out.push({
      kind: "trial",
      relatedId: t.id,
      recipient: { profileId: null, email: t.email, phone: t.phone, name: t.full_name },
      scheduledAt: t.scheduled_at,
      serviceType: t.service_type,
      trainerName: t.trainer?.full_name ?? null,
    });
  }
  return out;
}

// ─────────────── Resum diari d'agenda per al professional ───────────────

export type AgendaSession = { time: string; client: string; service: string };
export type TrainerAgenda = {
  relatedId: string;
  recipient: NotificationRecipient;
  sessions: AgendaSession[];
};

/**
 * Per a cada entrenador amb `trainer_daily_agenda_email` activat, la seva
 * agenda de DEMÀ (reserves 'booked' + proves 'confirmed'), ordenada per hora.
 * S'inclou encara que no tingui cap sessió (l'email ho indica). `relatedId` és
 * determinista per (entrenador, dia) per a la idempotència del cron.
 */
export async function listTomorrowTrainerAgendas(
  now = new Date(),
): Promise<TrainerAgenda[]> {
  const target = tomorrowMadrid(now);

  if (USE_MOCK) {
    const store = getStore();
    const optedIn = new Set(
      store.notification_preferences
        .filter((p) => p.trainer_daily_agenda_email)
        .map((p) => p.profile_id),
    );
    const trainers = store.profiles.filter(
      (p) => p.role === "trainer" && optedIn.has(p.id),
    );
    const clientName = (clientId: string) => {
      const c = store.clients.find((x) => x.id === clientId);
      return (
        (c && store.profiles.find((x) => x.id === c.profile_id)?.full_name) ||
        "Client"
      );
    };
    return trainers.map((t) => {
      const sessions: AgendaSession[] = [
        ...store.reservations
          .filter(
            (r) =>
              r.trainer_id === t.id &&
              r.status === "booked" &&
              madridDay(r.scheduled_at) === target,
          )
          .map((r) => ({
            iso: r.scheduled_at,
            client: clientName(r.client_id),
            service: SERVICE_LABELS[r.service_type],
          })),
        ...store.trial_bookings
          .filter(
            (b) =>
              b.trainer_id === t.id &&
              b.status === "confirmed" &&
              madridDay(b.scheduled_at) === target,
          )
          .map((b) => ({
            iso: b.scheduled_at,
            client: `${b.full_name} (prova)`,
            service: SERVICE_LABELS[b.service_type],
          })),
      ]
        .sort((a, b) => a.iso.localeCompare(b.iso))
        .map((s) => ({ time: madridTime(s.iso), client: s.client, service: s.service }));
      return {
        relatedId: stableUuid(`agenda:${t.id}:${target}`),
        recipient: { profileId: t.id, email: t.email, phone: t.phone, name: t.full_name },
        sessions,
      };
    });
  }

  const admin = createAdminClient();
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select(
      "profile_id, profile:profiles!notification_preferences_profile_id_fkey(id, email, phone, full_name, role)",
    )
    .eq("trainer_daily_agenda_email", true);
  type PrefRow = {
    profile_id: string;
    profile: { id: string; email: string | null; phone: string | null; full_name: string | null; role: string } | null;
  };
  const trainers = ((prefs as unknown as PrefRow[]) ?? []).filter(
    (p) => p.profile && p.profile.role === "trainer",
  );
  if (trainers.length === 0) return [];

  const ids = trainers.map((t) => t.profile_id);
  const from = new Date(now.getTime()).toISOString();
  const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const [res, trials] = await Promise.all([
    admin
      .from("reservations")
      .select(
        "scheduled_at, service_type, trainer_id, client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))",
      )
      .eq("status", "booked")
      .in("trainer_id", ids)
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
    admin
      .from("trial_bookings")
      .select("scheduled_at, service_type, trainer_id, full_name")
      .eq("status", "confirmed")
      .in("trainer_id", ids)
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
  ]);

  type ResRow = {
    scheduled_at: string;
    service_type: ServiceType;
    trainer_id: string | null;
    client: { profile: { full_name: string | null } | null } | null;
  };
  type TrialRow = {
    scheduled_at: string;
    service_type: ServiceType;
    trainer_id: string | null;
    full_name: string;
  };
  const byTrainer = new Map<string, { iso: string; client: string; service: string }[]>();
  const push = (tid: string | null, s: { iso: string; client: string; service: string }) => {
    if (!tid) return;
    (byTrainer.get(tid) ?? byTrainer.set(tid, []).get(tid)!).push(s);
  };
  for (const r of (res.data as unknown as ResRow[]) ?? []) {
    if (madridDay(r.scheduled_at) !== target) continue;
    push(r.trainer_id, {
      iso: r.scheduled_at,
      client: r.client?.profile?.full_name ?? "Client",
      service: SERVICE_LABELS[r.service_type],
    });
  }
  for (const t of (trials.data as unknown as TrialRow[]) ?? []) {
    if (madridDay(t.scheduled_at) !== target) continue;
    push(t.trainer_id, {
      iso: t.scheduled_at,
      client: `${t.full_name} (prova)`,
      service: SERVICE_LABELS[t.service_type],
    });
  }

  return trainers.map((t) => {
    const raw = (byTrainer.get(t.profile_id) ?? []).sort((a, b) =>
      a.iso.localeCompare(b.iso),
    );
    return {
      relatedId: stableUuid(`agenda:${t.profile_id}:${target}`),
      recipient: {
        profileId: t.profile_id,
        email: t.profile!.email,
        phone: t.profile!.phone,
        name: t.profile!.full_name,
      },
      sessions: raw.map((s) => ({ time: madridTime(s.iso), client: s.client, service: s.service })),
    };
  });
}

// ─── Bons a punt de caducar ──────────────────────────────────────────────────

/**
 * Dies d'antelació de l'avís de caducitat.
 *
 * Fix i no configurable a propòsit: només decideix quan surt un correu de
 * cortesia, i una setmana és temps de sobres per reservar el que queda. Fer-ho
 * configurable afegiria un ajust més a Configuració que ningú tocaria mai.
 */
export const BONO_EXPIRY_WARNING_DAYS = 7;

export type ExpiringBonoTarget = {
  relatedId: string;
  recipient: NotificationRecipient;
  serviceType: ServiceType;
  remainingSessions: number;
  expiresAt: string;
};

/**
 * Bons que caduquen dins dels propers `BONO_EXPIRY_WARNING_DAYS` dies, encara
 * utilitzables i amb sessions sense fer.
 *
 * `relatedId` és determinista a partir de l'id del bo i la seva data de
 * caducitat: així `notifyOnce` no reenvia l'avís cada dia que el cron corre
 * dins de la finestra, però sí que en tornaria a enviar un si algun dia la
 * data canviés.
 */
export async function listExpiringBonoTargets(
  today: string,
): Promise<ExpiringBonoTarget[]> {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + BONO_EXPIRY_WARNING_DAYS);
  const limitStr = limit.toISOString().slice(0, 10);
  const out: ExpiringBonoTarget[] = [];

  const push = (
    b: { id: string; service_type: ServiceType; remaining_sessions: number; expires_at: string | null },
    recipient: NotificationRecipient | null,
  ) => {
    if (!recipient || !b.expires_at) return;
    out.push({
      relatedId: stableUuid(`bono-expiring:${b.id}:${b.expires_at}`),
      recipient,
      serviceType: b.service_type,
      remainingSessions: b.remaining_sessions,
      expiresAt: b.expires_at,
    });
  };

  if (USE_MOCK) {
    const store = getStore();
    for (const b of store.bonos) {
      if (b.status !== "active" && b.status !== "pending_payment") continue;
      if (!b.expires_at) continue;
      if (b.expires_at < today || b.expires_at > limitStr) continue;
      if (b.remaining_sessions <= 0) continue;
      const client = store.clients.find((c) => c.id === b.client_id);
      const p = store.profiles.find((x) => x.id === client?.profile_id);
      push(b, p ? { profileId: p.id, email: p.email, phone: p.phone, name: p.full_name } : null);
    }
    return out;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bonos")
    .select(
      `id, service_type, remaining_sessions, expires_at,
       client:clients!bonos_client_id_fkey(profile:profiles!clients_profile_id_fkey(id, full_name, email, phone))`,
    )
    .in("status", ["active", "pending_payment"])
    .gt("remaining_sessions", 0)
    .not("expires_at", "is", null)
    .gte("expires_at", today)
    .lte("expires_at", limitStr);

  type Row = {
    id: string;
    service_type: ServiceType;
    remaining_sessions: number;
    expires_at: string | null;
    client: {
      profile: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
    } | null;
  };
  for (const b of (data ?? []) as unknown as Row[]) {
    const p = b.client?.profile;
    push(b, p ? { profileId: p.id, email: p.email, phone: p.phone, name: p.full_name } : null);
  }
  return out;
}

// ─── Bons pendents de pagament que decauen ───────────────────────────────────

export type UnpaidBonoTarget = {
  bonoId: string;
  relatedId: string;
  recipient: NotificationRecipient;
  serviceType: ServiceType;
  /** Reserves futures que s'han cancel·lat en anul·lar el bo. */
  cancelledCount: number;
};

/**
 * Anul·la els bons pendents de pagament que ja han passat el termini i
 * allibera les franges que ocupaven.
 *
 * El termini es compta des de la PRIMERA reserva feta amb el bo: qui l'ha
 * comprat però encara no l'ha estrenat no li treu el lloc a ningú, i per això
 * un bo amb `first_reservation_at` nul no es toca mai, per vell que sigui.
 *
 * Només cancel·la reserves FUTURES: les sessions que el client ja ha fet no
 * es desfan, i el deute per aquelles queda viu al marge d'aquest procés.
 *
 * Torna els bons anul·lats perquè qui crida enviï l'avís. Idempotent per
 * construcció: en canviar l'estat, el bo ja no torna a sortir a la consulta.
 */
export async function cancelOverduePendingBonos(
  now = new Date(),
): Promise<UnpaidBonoTarget[]> {
  const { pendingPaymentCancelEnabled, pendingPaymentCancelHours } =
    await getCenterSettings();
  if (!pendingPaymentCancelEnabled || !pendingPaymentCancelHours) return [];

  const limit = new Date(
    now.getTime() - pendingPaymentCancelHours * 60 * 60 * 1000,
  ).toISOString();
  const nowISO = now.toISOString();
  const out: UnpaidBonoTarget[] = [];

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    for (const b of store.bonos) {
      if (b.status !== "pending_payment") continue;
      if (!b.first_reservation_at) continue;
      if (b.first_reservation_at > limit) continue;

      let cancelled = 0;
      const freedMock: { trainer_id: string | null; scheduled_at: string; service_type: ServiceType }[] = [];
      for (const r of store.reservations)
        if (r.bono_id === b.id && r.status === "booked" && r.scheduled_at > nowISO) {
          r.status = "cancelled";
          freedMock.push(r);
          cancelled++;
        }
      b.status = "unpaid";
      saveStore(store);
      const { promoteFromWaitlist } = await import("@/lib/data/waitlist");
      for (const f of freedMock)
        await promoteFromWaitlist({
          trainerId: f.trainer_id,
          scheduledAt: f.scheduled_at,
          serviceType: f.service_type,
        });

      const client = store.clients.find((c) => c.id === b.client_id);
      const p = store.profiles.find((x) => x.id === client?.profile_id);
      if (p)
        out.push({
          bonoId: b.id,
          relatedId: stableUuid(`bono-unpaid:${b.id}`),
          recipient: { profileId: p.id, email: p.email, phone: p.phone, name: p.full_name },
          serviceType: b.service_type,
          cancelledCount: cancelled,
        });
    }
    saveStore(store);
    return out;
  }

  const admin = createAdminClient();
  const { data: overdue } = await admin
    .from("bonos")
    .select(
      `id, service_type,
       client:clients!bonos_client_id_fkey(profile:profiles!clients_profile_id_fkey(id, full_name, email, phone))`,
    )
    .eq("status", "pending_payment")
    .not("first_reservation_at", "is", null)
    .lte("first_reservation_at", limit);

  type Row = {
    id: string;
    service_type: ServiceType;
    client: {
      profile: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
    } | null;
  };

  for (const b of (overdue ?? []) as unknown as Row[]) {
    // Primer alliberar les franges, després tancar el bo: si alguna cosa peta pel
    // mig, el bo segueix pendent i el barrido del dia següent hi tornarà.
    const { data: freed } = await admin
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("bono_id", b.id)
      .eq("status", "booked")
      .gt("scheduled_at", nowISO)
      .select("id, trainer_id, scheduled_at, service_type");

    // Les franges que acaben de quedar lliures són tan bones com qualsevol
    // altra per a qui les esperava: mateix hook que les altres cancel·lacions.
    const { promoteFromWaitlist } = await import("@/lib/data/waitlist");
    for (const f of (freed ?? []) as unknown as {
      trainer_id: string | null;
      scheduled_at: string;
      service_type: ServiceType;
    }[])
      await promoteFromWaitlist({
        trainerId: f.trainer_id,
        scheduledAt: f.scheduled_at,
        serviceType: f.service_type,
      });

    const { error } = await admin
      .from("bonos")
      .update({ status: "unpaid" })
      .eq("id", b.id)
      .eq("status", "pending_payment");
    if (error) continue;

    const p = b.client?.profile;
    if (p)
      out.push({
        bonoId: b.id,
        relatedId: stableUuid(`bono-unpaid:${b.id}`),
        recipient: { profileId: p.id, email: p.email, phone: p.phone, name: p.full_name },
        serviceType: b.service_type,
        cancelledCount: (freed ?? []).length,
      });
  }
  return out;
}
