import type {
  NotificationEventType,
  NotificationChannel,
} from "@/lib/notifications/types";

/** Clau de preferència: `${tipus}_${canal}` (coincideix amb la columna a BD). */
export type PreferenceKey = `${NotificationEventType}_${NotificationChannel}`;

/**
 * Preferències per defecte. Només email: l'essencial activat, la resta no.
 *
 * Els esdeveniments d'`ALWAYS_SENT_EVENTS` també hi surten, però el seu valor
 * aquí ja no és una preferència: és el `true` de seguretat que llegeix
 * `rowToPrefs` quan ignora la columna de la BD. Qui els dispara ho fa amb
 * `ignorePreferences: true` i no arriba ni a mirar-lo.
 */
export const DEFAULT_PREFERENCES: Record<PreferenceKey, boolean> = {
  reservation_confirmed_email: true,
  // Sempre (ALWAYS_SENT_EVENTS): una reserva que ja no existeix no la pot veure enlloc.
  reservation_cancelled_email: true,
  session_reminder_email: false,
  trial_request_email: false,
  // Sempre (ALWAYS_SENT_EVENTS): és la resposta al que va demanar ell.
  trial_status_email: true,
  bono_low_email: false,
  // OPCIONAL a posta, tot i que hi hagi diners pel mig: avisa ABANS que
  // caduqui, d'un estat que ja es veu a la seva pantalla de bons.
  bono_expiring_soon_email: true,
  // Sempre (ALWAYS_SENT_EVENTS): li han cancel·lat sessions ja reservades.
  bono_unpaid_cancelled_email: true,
  community_email: false,
  // Sempre (ALWAYS_SENT_EVENTS). Aquí es mouen diners sense que el client premi res: se li
  // cobra un mes, se li atura la subscripció, se li congela o se li dona de
  // baixa.
  subscription_renewed_email: true,
  subscription_payment_failed_email: true,
  subscription_cancelled_email: true,
  subscription_paused_email: true,
  subscription_resumed_email: true,
  // Avisos del professional sobre la seva agenda (operatius = true).
  trainer_booking_received_email: true,
  trainer_booking_cancelled_email: true,
  trainer_daily_agenda_email: false,
  // Avís a l'admin quan algú es registra (email actiu per defecte).
  new_client_registered_email: true,
  // Avís manual (trainer acciona explícitament) — desactivat a preferències.
  new_exercises_assigned_email: false,
  // La factura s'envia sempre amb `ignorePreferences`; aquestes claus no tenen
  // columna a BD ni surten a la UI, hi són perquè el tipus quedi complet.
  invoice_generated_email: false,
  // Igual: el tiquet de suport va a qui desenvolupa l'app, que no té perfil
  // ni preferències. També s'envia amb `ignorePreferences`.
  support_ticket_created_email: false,
  // Sempre (ALWAYS_SENT_EVENTS): se li acaba de crear una reserva sense
  // demanar-la en aquell moment; si no ho sap, no hi va i crema la sessió.
  waitlist_fulfilled_email: true,
  // Sempre (ALWAYS_SENT_EVENTS): un val és al portador i aquest correu és
  // l'única senyal que li arriba si algú el bescanvia per error o de mala fe.
  gift_voucher_redeemed_email: true,
  // El correu del regal el dispara qui compra cap a una adreça que escriu ell;
  // no hi ha cap perfil ni cap preferència a consultar (ignorePreferences).
  gift_voucher_gifted_email: false,
};

/**
 * Esdeveniments que s'envien SEMPRE, sense passar per preferències.
 *
 * Són avisos que la persona no hauria de poder desactivar sense adonar-se'n.
 * No tenen columna útil a `notification_preferences` ni surten a la UI de
 * Configuració: qui els dispara ho fa amb `notify(..., { ignorePreferences: true })`.
 *
 * EL CRITERI, PER NO HAVER DE DISCUTIR-HO CADA VEGADA
 *
 * És obligatori l'avís que compleix les TRES coses alhora: notifica una cosa
 * JA CONSUMADA, que el client NO ha provocat en aquell instant, i que NO pot
 * descobrir mirant l'app. Un recordatori d'una cosa que encara no ha passat, o
 * un avís sobre un estat que ja es veu a la seva pantalla, no hi entra: apagar-
 * lo és una preferència legítima.
 *
 * Per això `reservation_cancelled` hi és i `reservation_confirmed` no: una
 * reserva que existeix la pot veure a l'app quan vulgui; una que ja no
 * existeix, no. I per això `bono_expiring_soon` es queda opcional encara que hi
 * hagi diners pel mig: avisa ABANS, d'un estat que és visible.
 *
 * `gift_voucher_redeemed` hi entra per un motiu que no és l'obvi: el val és un
 * instrument al portador, i aquest correu és l'ÚNICA senyal que li pot arribar
 * a qui el va pagar si algú el bescanvia per error o de mala fe.
 *
 * AFEGIR-NE UN AQUÍ JA EL TREU DE LA UI I DE LA BD
 *
 * Aquesta llista governa `PREFERENCE_KEYS`, i `PREFERENCE_KEYS` governa alhora
 * què es pinta, què s'escriu i què es llegeix. Per això un `false` desat abans
 * d'aquest canvi queda ignorat tot sol: `rowToPrefs` ja no mira aquestes
 * columnes. No cal migrar cap dada.
 */
export type AlwaysSentEvent =
  // Avisos administratius sense cap pantalla de preferències al darrere.
  | "invoice_generated"
  | "support_ticket_created"
  | "gift_voucher_gifted"
  // Diners que es mouen sols sobre una subscripció que paga el client.
  | "subscription_renewed"
  | "subscription_payment_failed"
  | "subscription_cancelled"
  | "subscription_paused"
  | "subscription_resumed"
  // Coses ja consumades que el client no pot veure a l'app.
  | "reservation_cancelled"
  | "bono_unpaid_cancelled"
  | "waitlist_fulfilled"
  | "trial_status"
  | "gift_voucher_redeemed";

/** Els mateixos, en valor, per poder filtrar-los en temps d'execució. */
export const ALWAYS_SENT_EVENTS: AlwaysSentEvent[] = [
  "invoice_generated",
  "support_ticket_created",
  "gift_voucher_gifted",
  "subscription_renewed",
  "subscription_payment_failed",
  "subscription_cancelled",
  "subscription_paused",
  "subscription_resumed",
  "reservation_cancelled",
  "bono_unpaid_cancelled",
  "waitlist_fulfilled",
  "trial_status",
  "gift_voucher_redeemed",
];

/** Claus que sí tenen columna a BD. La resta ni es llegeixen ni es desen. */
export type PersistedPreferenceKey = Exclude<
  PreferenceKey,
  `${AlwaysSentEvent}_${NotificationChannel}`
>;

// Es filtra a partir de la llista d'esdeveniments i no amb un prefix escrit a
// mà: així afegir-ne un de nou no pot deixar-se una clau intentant escriure's
// en una columna que no existeix.
export const PREFERENCE_KEYS = (
  Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]
).filter((k): k is PersistedPreferenceKey =>
  ALWAYS_SENT_EVENTS.every((e) => !k.startsWith(`${e}_`)),
);

export function prefKey(
  type: NotificationEventType,
  channel: NotificationChannel,
): PreferenceKey {
  return `${type}_${channel}` as PreferenceKey;
}

export type NotificationPreferences = Record<PreferenceKey, boolean>;
