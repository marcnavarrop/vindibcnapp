import ca from "@/messages/ca.json";

/**
 * El text dels avisos que veu el CLIENT surt del diccionari.
 *
 * Aquests deu es pinten en tres idiomes a Configuració → Notificacions, i el
 * català no es pot escriure dues vegades: aquí i a `messages/ca.json`. Un dia
 * se'n canviaria un i l'altre no. Els altres nou només els veuen l'admin i el
 * professional, que treballen en català fix, i es queden escrits a sota.
 */
const CLIENT_EVENT_TEXT = ca.config.notifications.events;

/**
 * Tipus del sistema de notificacions. El codi dispara "esdeveniments" i el
 * sistema (notify) decideix per quins canals enviar-los segons les preferències
 * de cada persona. Compartits client/servidor (sense `server-only`), per a la UI.
 */

/** Tipus d'esdeveniment. Coincideixen amb les columnes de preferències. */
export type NotificationEventType =
  | "reservation_confirmed"
  | "reservation_cancelled"
  | "session_reminder"
  | "trial_request"
  | "trial_status"
  | "bono_low"
  | "bono_expiring_soon"
  | "bono_unpaid_cancelled"
  | "community"
  // Avisos que rep el professional com a dueño de la seva agenda:
  | "trainer_booking_received"
  | "trainer_booking_cancelled"
  | "trainer_daily_agenda"
  // Avís de gestió per a l'admin:
  | "new_client_registered"
  // Avisos manuals (accionats pel trainer/admin, no apareixen a preferències):
  | "new_exercises_assigned"
  | "invoice_generated"
  // Llista d'espera:
  | "waitlist_fulfilled"
  // Vals de regal:
  | "gift_voucher_redeemed"
  | "gift_voucher_gifted"
  // Avís intern cap a qui desenvolupa l'app (no és cap usuari del centre):
  | "support_ticket_created";

/**
 * Canal d'enviament. Només email.
 *
 * Es manté com a tipus d'un sol valor i no s'elimina perquè
 * `notification_log.channel` i `alreadySent()` el segueixen fent servir per
 * distingir enviaments, i el dia que entri un canal nou (SMS, push) el punt
 * d'extensió ja és aquí. WhatsApp va sortir a la 0055: mai va arribar a
 * enviar res.
 */
export type NotificationChannel = "email";

export type NotificationLogStatus = "sent" | "failed" | "skipped_preference";

/** Destinatari (pot ser un visitant sense compte: profileId = null). */
export type NotificationRecipient = {
  profileId: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
};

/** Un esdeveniment a notificar. `data` és el context per a la plantilla. */
export type NotificationEvent = {
  type: NotificationEventType;
  recipient: NotificationRecipient;
  /** Id de l'entitat que l'origina (reserva, prova…), per a log i idempotència. */
  relatedId?: string | null;
  data: Record<string, string>;
};

export type NotificationAudience = "client" | "trainer" | "admin";
/** Agrupació a la UI de preferències. */
export type NotificationGroup = "general" | "agenda";

export const GROUP_LABELS: Record<NotificationGroup, string> =
  ca.config.notifications.groups;

/** Metadades de cada tipus d'esdeveniment per a la UI de preferències. */
export const EVENT_META: Record<
  NotificationEventType,
  {
    label: string;
    description: string;
    audience: NotificationAudience[];
    group: NotificationGroup;
  }
> = {
  reservation_confirmed: {
    ...CLIENT_EVENT_TEXT.reservation_confirmed,
    audience: ["client"],
    group: "general",
  },
  reservation_cancelled: {
    ...CLIENT_EVENT_TEXT.reservation_cancelled,
    audience: ["client"],
    group: "general",
  },
  session_reminder: {
    ...CLIENT_EVENT_TEXT.session_reminder,
    audience: ["client"],
    group: "general",
  },
  trial_request: {
    label: "Nova sol·licitud de prova",
    description: "Quan un visitant demana una sessió de prova.",
    audience: ["trainer", "admin"],
    group: "general",
  },
  trial_status: {
    ...CLIENT_EVENT_TEXT.trial_status,
    audience: ["client"],
    group: "general",
  },
  bono_low: {
    ...CLIENT_EVENT_TEXT.bono_low,
    audience: ["client"],
    group: "general",
  },
  bono_expiring_soon: {
    ...CLIENT_EVENT_TEXT.bono_expiring_soon,
    audience: ["client"],
    group: "general",
  },
  bono_unpaid_cancelled: {
    ...CLIENT_EVENT_TEXT.bono_unpaid_cancelled,
    audience: ["client"],
    group: "general",
  },
  community: {
    ...CLIENT_EVENT_TEXT.community,
    audience: ["client", "trainer"],
    group: "general",
  },
  trainer_booking_received: {
    label: "Nova reserva d'un client",
    description: "Quan un client et reserva una sessió.",
    audience: ["trainer"],
    group: "agenda",
  },
  trainer_booking_cancelled: {
    label: "Cancel·lació d'un client",
    description: "Quan un client cancel·la una sessió teva.",
    audience: ["trainer"],
    group: "agenda",
  },
  trainer_daily_agenda: {
    label: "Resum diari de l'agenda",
    description: "Cada tarda, les sessions que tens l'endemà.",
    audience: ["trainer"],
    group: "agenda",
  },
  new_client_registered: {
    label: "Nou client registrat",
    description: "Quan algú es dóna d'alta pel seu compte.",
    audience: ["admin"],
    group: "general",
  },
  new_exercises_assigned: {
    label: "Exercicis nous assignats",
    description: "Quan el trainer assigna exercicis nous al client.",
    audience: [],
    group: "general",
  },
  invoice_generated: {
    label: "Factura generada",
    description: "Quan l'administració tanca una liquidació teva i n'emet el document.",
    // `audience: []` = fora de la UI de preferències a propòsit. És un avís
    // administratiu sobre la pròpia retribució, no una comoditat: s'envia
    // sempre (ignorePreferences), com els correus de compte.
    audience: [],
    group: "general",
  },
  waitlist_fulfilled: {
    ...CLIENT_EVENT_TEXT.waitlist_fulfilled,
    audience: ["client"],
    group: "general",
  },
  gift_voucher_redeemed: {
    ...CLIENT_EVENT_TEXT.gift_voucher_redeemed,
    audience: ["client"],
    group: "general",
  },
  gift_voucher_gifted: {
    label: "Val de regal enviat",
    description: "El correu amb el codi que s'envia a qui rep el regal.",
    // `audience: []`: el destinatari és qui rep el regal, que pot no tenir
    // compte al centre. L'envia qui compra, explícitament, amb una adreça que
    // escriu ell: no hi ha cap preferència a consultar.
    audience: [],
    group: "general",
  },
  support_ticket_created: {
    label: "Nou tiquet de suport",
    description: "Quan algú de l'equip reporta una incidència o un dubte.",
    // `audience: []` com invoice_generated: el destinatari és qui desenvolupa
    // l'app, que no té compte al centre i per tant no té cap pantalla de
    // preferències on triar si el vol rebre.
    audience: [],
    group: "general",
  },
};

/** Ordre de presentació dels esdeveniments a la UI. */
export const EVENT_ORDER: NotificationEventType[] = [
  "reservation_confirmed",
  "reservation_cancelled",
  "session_reminder",
  "bono_low",
  "bono_expiring_soon",
  "bono_unpaid_cancelled",
  "trial_request",
  "trial_status",
  "community",
  "trainer_booking_received",
  "trainer_booking_cancelled",
  "trainer_daily_agenda",
  "new_client_registered",
  "new_exercises_assigned",
  "invoice_generated",
  "waitlist_fulfilled",
  "gift_voucher_redeemed",
  "gift_voucher_gifted",
  "support_ticket_created",
];
