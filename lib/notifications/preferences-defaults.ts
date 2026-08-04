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
  // Actiu per defecte: que un bo pagat estigui a punt de caducar és
  // informació que el client vol tenir, no una comoditat opcional.
  bono_expiring_soon_email: true,
  bono_expiring_soon_whatsapp: false,
  // Al client se li han cancel·lat sessions: assabentar-se'n no és opcional.
  bono_unpaid_cancelled_email: true,
  bono_unpaid_cancelled_whatsapp: false,
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
  // La factura s'envia sempre amb `ignorePreferences`; aquestes claus no tenen
  // columna a BD ni surten a la UI, hi són perquè el tipus quedi complet.
  invoice_generated_email: false,
  invoice_generated_whatsapp: false,
};

/**
 * Esdeveniments que s'envien SEMPRE, sense passar per preferències.
 *
 * Són avisos administratius que la persona no hauria de poder desactivar sense
 * adonar-se'n (la factura de la seva pròpia liquidació). No tenen columna a
 * `notification_preferences` ni surten a la UI de Configuració: qui els dispara
 * ho fa amb `notify(..., { ignorePreferences: true })`.
 */
export type AlwaysSentEvent = "invoice_generated";

/** Claus que sí tenen columna a BD. La resta ni es llegeixen ni es desen. */
export type PersistedPreferenceKey = Exclude<
  PreferenceKey,
  `${AlwaysSentEvent}_${NotificationChannel}`
>;

export const PREFERENCE_KEYS = (
  Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]
).filter(
  (k): k is PersistedPreferenceKey => !k.startsWith("invoice_generated_"),
);

export function prefKey(
  type: NotificationEventType,
  channel: NotificationChannel,
): PreferenceKey {
  return `${type}_${channel}` as PreferenceKey;
}

export type NotificationPreferences = Record<PreferenceKey, boolean>;
