import "server-only";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/notifications/templates";
import type { NotificationEvent, NotificationLogStatus } from "@/lib/notifications/types";
import type { NotificationRecipient } from "@/lib/notifications/types";

export type ChannelResult = {
  status: NotificationLogStatus;
  error?: string;
};

/** Adaptador d'email (Resend). Mai llança: retorna l'estat per al log. */
export async function sendViaEmail(
  event: NotificationEvent,
  recipient: NotificationRecipient,
): Promise<ChannelResult> {
  if (!recipient.email)
    return { status: "failed", error: "Sense adreça de correu" };
  const { subject, html, text } = renderEmail(event);
  const res = await sendEmail({ to: recipient.email, subject, html, text });
  return res.ok
    ? { status: "sent" }
    : { status: "failed", error: res.error };
}
