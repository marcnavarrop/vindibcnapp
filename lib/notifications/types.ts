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
  | "community";

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

/** Metadades de cada tipus d'esdeveniment per a la UI de preferències. */
export const EVENT_META: Record<
  NotificationEventType,
  { label: string; description: string; audience: ("client" | "trainer" | "admin")[] }
> = {
  reservation_confirmed: {
    label: "Reserva confirmada",
    description: "Quan es crea una reserva a nom teu.",
    audience: ["client"],
  },
  reservation_cancelled: {
    label: "Reserva cancel·lada",
    description: "Quan s'anul·la una reserva teva.",
    audience: ["client", "trainer"],
  },
  session_reminder: {
    label: "Recordatori de sessió",
    description: "Un avís el dia abans de cada sessió.",
    audience: ["client"],
  },
  trial_request: {
    label: "Nova sol·licitud de prova",
    description: "Quan un visitant demana una sessió de prova.",
    audience: ["trainer", "admin"],
  },
  trial_status: {
    label: "Estat de la teva prova",
    description: "Quan la teva sessió de prova s'accepta o es rebutja.",
    audience: ["client"],
  },
  bono_low: {
    label: "Bo a punt d'esgotar-se",
    description: "Quan et queda 1 sessió al bo.",
    audience: ["client"],
  },
  community: {
    label: "Novetats de la comunitat",
    description: "Nous anuncis del centre.",
    audience: ["client", "trainer"],
  },
};

/** Ordre de presentació dels esdeveniments a la UI. */
export const EVENT_ORDER: NotificationEventType[] = [
  "reservation_confirmed",
  "reservation_cancelled",
  "session_reminder",
  "bono_low",
  "trial_request",
  "trial_status",
  "community",
];
