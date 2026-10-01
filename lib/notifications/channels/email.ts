import "server-only";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/notifications/templates";
import { getCenterContact } from "@/lib/data/center-settings";
import { publicContact } from "@/lib/center-contact";
import type { NotificationEvent, NotificationLogStatus } from "@/lib/notifications/types";
import type { NotificationRecipient } from "@/lib/notifications/types";

export type ChannelResult = {
  status: NotificationLogStatus;
  error?: string;
  /**
   * Id que torna el proveïdor en acceptar l'enviament. Es desa al log: sense
   * ell, saber si un correu ha arribat de debò obliga a creuar a mà per data
   * i destinatari contra l'historial del proveïdor.
   */
  providerId?: string;
};

/** Adaptador d'email (Resend). Mai llança: retorna l'estat per al log. */
export async function sendViaEmail(
  event: NotificationEvent,
  recipient: NotificationRecipient,
): Promise<ChannelResult> {
  if (!recipient.email)
    return { status: "failed", error: "Sense adreça de correu" };
  // El contacte del centre: el peu i el Reply-To dels correus a clients.
  const contact = publicContact(await getCenterContact());
  const { subject, html, text, replyTo } = renderEmail(event, contact);
  const res = await sendEmail({ to: recipient.email, subject, html, text, replyTo });
  return res.ok
    ? { status: "sent", providerId: res.id }
    : { status: "failed", error: res.error };
}
