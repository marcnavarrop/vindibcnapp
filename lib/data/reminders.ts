import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import type { NotificationRecipient } from "@/lib/notifications/types";
import type { ServiceType } from "@/types/database";

const TZ = "Europe/Madrid";

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
