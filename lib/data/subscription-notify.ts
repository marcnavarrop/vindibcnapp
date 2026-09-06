import "server-only";
import { notifyOnce } from "@/lib/notifications";
import { getProfileContact } from "@/lib/notifications";
import { stableUuid } from "@/lib/data/reminders";
import { profileIdForClient } from "@/lib/data/subscriptions";
import type { Subscription } from "@/lib/data/subscriptions";

/**
 * Els tres avisos de la subscripció.
 *
 * TOT EL QUE HI HA AQUÍ HA DE PODER CÓRRER SENSE SESSIÓ. Els tres els disparen
 * el cron de renovació i el webhook de Stripe, que no tenen cap usuari al
 * darrere: `getProfileContact`, `profileIdForClient` i el registre d'enviaments
 * van tots per `service_role`. És la lliçó del bloc anterior, on la comprovació
 * de disponibilitat anava pel client de sessió i la sèrie no reservava mai res.
 *
 * Cap dels tres tomba qui el crida. Un correu que no surt és un disgust; perdre
 * la renovació —o fer que Stripe reintenti una factura ja complerta— seria molt
 * pitjor. Es registra i s'segueix.
 *
 * `notifyOnce` amb un `relatedId` estable per FET, no per moment: la renovació
 * d'un cicle és un avís i només un, el reintenti qui el reintenti.
 */

async function send(
  sub: Subscription,
  type: "subscription_renewed" | "subscription_payment_failed" | "subscription_cancelled",
  relatedKey: string,
  data: Record<string, string>,
): Promise<void> {
  try {
    const profileId = await profileIdForClient(sub.clientId);
    if (!profileId) return;
    const recipient = await getProfileContact(profileId);
    if (!recipient) return;

    await notifyOnce({
      type,
      recipient,
      relatedId: stableUuid(relatedKey),
      data: { name: recipient.name ?? "", serviceType: sub.serviceType, ...data },
    });
  } catch (e) {
    console.error(`[subscripcions] l'avís ${type} de ${sub.id} no ha sortit:`, e);
  }
}

/** El mes nou ja hi és. Un avís per cicle. */
export async function notifySubscriptionRenewed(
  sub: Subscription,
  cycleStart: string,
  until: string | null,
): Promise<void> {
  await send(sub, "subscription_renewed", `subscription-renewed:${sub.id}:${cycleStart}`, {
    sessions: String(sub.sessionsPerCycle),
    // En CRU. La plantilla el formata amb l'idioma de qui el llegeix; una data
    // ja formatada aquí sortiria en català dins d'un correu en castellà.
    untilIso: until ?? "",
  });
}

/**
 * El mes no s'ha cobrat i la subscripció queda aturada.
 *
 * L'identificador porta el cicle: si el mes vinent torna a passar, és un fet
 * nou i s'avisa un altre cop. Sense el cicle, el segon impagament seria mut.
 */
export async function notifySubscriptionPaymentFailed(
  sub: Subscription,
  cycleStart: string,
): Promise<void> {
  await send(sub, "subscription_payment_failed", `subscription-failed:${sub.id}:${cycleStart}`, {
    // Igual que la data: l'import viatja en cru i el formata la plantilla.
    amountEur: String(sub.unitPrice),
  });
}

/** Baixa definitiva. Un sol avís per subscripció: no se'n dona de baixa dues. */
export async function notifySubscriptionCancelled(sub: Subscription): Promise<void> {
  await send(sub, "subscription_cancelled", `subscription-cancelled:${sub.id}`, {});
}
