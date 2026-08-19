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

export type NotificationChannel = "email" | "whatsapp";

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

export const GROUP_LABELS: Record<NotificationGroup, string> = {
  general: "Avisos",
  agenda: "La meva agenda",
};

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
    label: "Reserva confirmada",
    description: "Quan es crea una reserva a nom teu.",
    audience: ["client"],
    group: "general",
  },
  reservation_cancelled: {
    label: "Reserva cancel·lada",
    description: "Quan s'anul·la una reserva teva.",
    audience: ["client"],
    group: "general",
  },
  session_reminder: {
    label: "Recordatori de sessió",
    description: "Un avís el dia abans de cada sessió.",
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
    label: "Estat de la teva prova",
    description: "Quan la teva sessió de prova s'accepta o es rebutja.",
    audience: ["client"],
    group: "general",
  },
  bono_low: {
    label: "Bo a punt d'esgotar-se",
    description: "Quan et queda 1 sessió al bo.",
    audience: ["client"],
    group: "general",
  },
  bono_expiring_soon: {
    label: "Bo a punt de caducar",
    description: "Uns dies abans que caduqui un bo amb sessions sense fer.",
    audience: ["client"],
    group: "general",
  },
  bono_unpaid_cancelled: {
    label: "Bo anul·lat per impagament",
    description: "Si un bo pendent de pagament decau i es cancel·len les sessions reservades.",
    audience: ["client"],
    group: "general",
  },
  community: {
    label: "Novetats de la comunitat",
    description: "Nous anuncis del centre.",
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
    label: "Plaça de la llista d'espera",
    description: "Quan s'allibera una plaça que esperaves i te la confirmem.",
    audience: ["client"],
    group: "general",
  },
  gift_voucher_redeemed: {
    label: "T'han bescanviat un regal",
    description: "Quan algú fa servir un val de regal que has comprat.",
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
