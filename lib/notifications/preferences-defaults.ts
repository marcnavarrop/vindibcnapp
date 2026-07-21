import type {
  NotificationEventType,
  NotificationChannel,
} from "@/lib/notifications/types";

/** Clau de preferència: `${tipus}_${canal}` (coincideix amb la columna a BD). */
export type PreferenceKey = `${NotificationEventType}_${NotificationChannel}`;

/**
 * Preferències per defecte. L'essencial activat per email; la resta i tot
 * WhatsApp desactivat (WhatsApp encara no funciona).
 */
export const DEFAULT_PREFERENCES: Record<PreferenceKey, boolean> = {
  reservation_confirmed_email: true,
  reservation_confirmed_whatsapp: false,
  reservation_cancelled_email: true,
  reservation_cancelled_whatsapp: false,
  session_reminder_email: false,
  session_reminder_whatsapp: false,
  trial_request_email: false,
  trial_request_whatsapp: false,
  trial_status_email: true,
  trial_status_whatsapp: false,
  bono_low_email: false,
  bono_low_whatsapp: false,
  community_email: false,
  community_whatsapp: false,
  // Avisos del professional sobre la seva agenda (operatius = true).
  trainer_booking_received_email: true,
  trainer_booking_received_whatsapp: false,
  trainer_booking_cancelled_email: true,
  trainer_booking_cancelled_whatsapp: false,
  trainer_daily_agenda_email: false,
  trainer_daily_agenda_whatsapp: false,
  // Avís a l'admin quan algú es registra (email actiu per defecte).
  new_client_registered_email: true,
  new_client_registered_whatsapp: false,
  // Avís manual (trainer acciona explícitament) — desactivat a preferències.
  new_exercises_assigned_email: false,
  new_exercises_assigned_whatsapp: false,
};

export const PREFERENCE_KEYS = Object.keys(
  DEFAULT_PREFERENCES,
) as PreferenceKey[];

export function prefKey(
  type: NotificationEventType,
  channel: NotificationChannel,
): PreferenceKey {
  return `${type}_${channel}` as PreferenceKey;
}

export type NotificationPreferences = Record<PreferenceKey, boolean>;
