import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { getPreferences } from "@/lib/notifications/preferences";
import {
  DEFAULT_PREFERENCES,
  prefKey,
} from "@/lib/notifications/preferences-defaults";
import { writeLog, alreadySent } from "@/lib/notifications/log";
import { sendViaEmail } from "@/lib/notifications/channels/email";
import { sendViaWhatsApp } from "@/lib/notifications/channels/whatsapp";
import type {
  NotificationChannel,
  NotificationEvent,
} from "@/lib/notifications/types";

export type { NotificationEvent } from "@/lib/notifications/types";
export { alreadySent } from "@/lib/notifications/log";

const CHANNELS: NotificationChannel[] = ["email", "whatsapp"];

/**
 * Punt únic d'enviament. Resol les preferències del destinatari i, per cada
 * canal habilitat, crida l'adaptador i registra el resultat al log (inclòs
 * 'skipped_preference' si el canal està desactivat). MAI llança: qualsevol
 * error es registra però el flux principal (reserva, etc.) continua.
 */
export async function notify(
  event: NotificationEvent,
  opts?: { ignorePreferences?: boolean },
): Promise<void> {
  try {
    const { recipient } = event;
    // Visitant sense compte → defaults (només l'essencial actiu).
    const prefs = recipient.profileId
      ? await getPreferences(recipient.profileId)
      : { ...DEFAULT_PREFERENCES };

    for (const channel of CHANNELS) {
      const key = prefKey(event.type, channel);
      if (!opts?.ignorePreferences && !prefs[key]) {
        await writeLog({
          profileId: recipient.profileId,
          recipient: channel === "email" ? recipient.email : recipient.phone,
          eventType: event.type,
          channel,
          status: "skipped_preference",
          relatedId: event.relatedId ?? null,
        });
        continue;
      }

      const result =
        channel === "email"
          ? await sendViaEmail(event, recipient)
          : await sendViaWhatsApp(event, recipient);

      await writeLog({
        profileId: recipient.profileId,
        recipient: channel === "email" ? recipient.email : recipient.phone,
        eventType: event.type,
        channel,
        status: result.status,
        error: result.error ?? null,
        relatedId: event.relatedId ?? null,
      });
    }
  } catch {
    // Best-effort absolut: mai tombar el flux de negoci per una notificació.
  }
}

/**
 * Variant idempotent: no envia si ja consta un enviament correcte d'aquest
 * esdeveniment per a `relatedId` en email (per als recordatoris del cron).
 */
export async function notifyOnce(event: NotificationEvent): Promise<boolean> {
  if (!event.relatedId) {
    await notify(event);
    return true;
  }
  if (await alreadySent(event.type, event.relatedId, "email")) return false;
  await notify(event);
  return true;
}

/** Dades de contacte d'un perfil (per construir el destinatari). */
export async function getProfileContact(
  profileId: string,
): Promise<{ profileId: string; email: string | null; phone: string | null; name: string | null } | null> {
  if (USE_MOCK) {
    const p = getStore().profiles.find((x) => x.id === profileId);
    if (!p) return null;
    return { profileId, email: p.email, phone: p.phone, name: p.full_name };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email, phone, full_name")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  return {
    profileId,
    email: data.email,
    phone: data.phone,
    name: data.full_name,
  };
}
