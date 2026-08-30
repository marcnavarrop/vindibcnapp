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
import type {
  NotificationEvent,
  NotificationRecipient,
} from "@/lib/notifications/types";
import { toLocale } from "@/lib/i18n/config";

export type { NotificationEvent } from "@/lib/notifications/types";
export { alreadySent } from "@/lib/notifications/log";

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

    // Un sol canal: l'email. El bucle sobre canals que hi havia aquí només
    // servia per acompanyar-lo d'un WhatsApp que mai va enviar res.
    const key = prefKey(event.type, "email");
    if (!opts?.ignorePreferences && !prefs[key]) {
      await writeLog({
        profileId: recipient.profileId,
        recipient: recipient.email,
        eventType: event.type,
        channel: "email",
        status: "skipped_preference",
        relatedId: event.relatedId ?? null,
      });
      return;
    }

    const result = await sendViaEmail(event, recipient);

    await writeLog({
      profileId: recipient.profileId,
      recipient: recipient.email,
      eventType: event.type,
      channel: "email",
      status: result.status,
      error: result.error ?? null,
      relatedId: event.relatedId ?? null,
    });
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

/**
 * Dades de contacte d'un perfil (per construir el destinatari).
 *
 * L'idioma va dins de la MATEIXA consulta que ja hi havia: dues columnes més
 * al `select` no costen cap viatge. Per això localitzar els correus no
 * afegeix ni una consulta a cap flux.
 *
 * NOMÉS el client en té. L'admin i el professional treballen en català fix a
 * tota l'app i els seus correus han d'anar igual, encara que ells s'hagin
 * triat un altre idioma per a la seva pantalla. La regla viu aquí, a l'origen,
 * i no a cada plantilla: així no se'n pot escapar cap.
 */
export async function getProfileContact(
  profileId: string,
): Promise<NotificationRecipient | null> {
  if (USE_MOCK) {
    const p = getStore().profiles.find((x) => x.id === profileId);
    if (!p) return null;
    return {
      profileId,
      email: p.email,
      phone: p.phone,
      name: p.full_name,
      locale: p.role === "client" ? toLocale(p.preferred_language) : null,
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email, phone, full_name, role, preferred_language")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  return {
    profileId,
    email: data.email,
    phone: data.phone,
    name: data.full_name,
    locale: data.role === "client" ? toLocale(data.preferred_language) : null,
  };
}
