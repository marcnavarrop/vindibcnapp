import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationLogStatus,
} from "@/lib/notifications/types";

export type LogEntry = {
  profileId: string | null;
  recipient: string | null;
  // Els esdeveniments de notificació, més els emails de compte (invitació/recuperació).
  eventType: NotificationEventType | "auth_invite" | "auth_recovery";
  channel: NotificationChannel;
  status: NotificationLogStatus;
  error?: string | null;
  relatedId?: string | null;
};

/** Registra un enviament (best-effort: si falla el log, no trenca res). */
export async function writeLog(entry: LogEntry): Promise<void> {
  try {
    if (USE_MOCK) {
      const store = getStore();
      store.notification_log.push({
        id: crypto.randomUUID(),
        profile_id: entry.profileId,
        recipient: entry.recipient,
        event_type: entry.eventType,
        channel: entry.channel,
        status: entry.status,
        error: entry.error ?? null,
        related_id: entry.relatedId ?? null,
        sent_at: new Date().toISOString(),
      });
      saveStore(store);
      return;
    }
    const admin = createAdminClient();
    await admin.from("notification_log").insert({
      profile_id: entry.profileId,
      recipient: entry.recipient,
      event_type: entry.eventType,
      channel: entry.channel,
      status: entry.status,
      error: entry.error ?? null,
      related_id: entry.relatedId ?? null,
    });
  } catch {
    // El log és secundari; mai ha de tombar el flux.
  }
}

/**
 * Idempotència: ¿ja s'ha enviat correctament aquest esdeveniment per a
 * `relatedId` en aquest canal? (evita recordatoris duplicats si el cron corre
 * dues vegades).
 */
export async function alreadySent(
  eventType: NotificationEventType,
  relatedId: string,
  channel: NotificationChannel,
): Promise<boolean> {
  if (USE_MOCK) {
    return getStore().notification_log.some(
      (l) =>
        l.event_type === eventType &&
        l.related_id === relatedId &&
        l.channel === channel &&
        l.status === "sent",
    );
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .eq("related_id", relatedId)
    .eq("channel", channel)
    .eq("status", "sent");
  return (count ?? 0) > 0;
}
