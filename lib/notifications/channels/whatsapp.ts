import "server-only";
import type { NotificationEvent, NotificationRecipient } from "@/lib/notifications/types";
import type { ChannelResult } from "@/lib/notifications/channels/email";

/**
 * Adaptador de WhatsApp — STUB.
 *
 * Mateixa interfície que l'email. De moment no envia res: registra el resultat
 * com 'skipped_preference' (canal encara no actiu). El dia que connectem
 * Twilio / WhatsApp Cloud API, només cal implementar l'enviament aquí dins,
 * sense tocar `notify()` ni cap altre lloc.
 */
export async function sendViaWhatsApp(
  _event: NotificationEvent,
  recipient: NotificationRecipient,
): Promise<ChannelResult> {
  // TODO: integrar Twilio / WhatsApp Cloud API.
  //   1. Comprovar recipient.phone (format E.164).
  //   2. Enviar la plantilla corresponent a event.type.
  //   3. Retornar { status: 'sent' } o { status: 'failed', error }.
  void recipient;
  return {
    status: "skipped_preference",
    error: "WhatsApp encara no està actiu",
  };
}
