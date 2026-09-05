"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getLiveSubscriptionForProfile, updateSubscription } from "@/lib/data/subscriptions";
import {
  openBillingPortal,
  scheduleStripeCancellation,
  startExtraCheckout,
} from "@/lib/data/stripe-checkout";
import { claimExtraSession, type ExtraRefusal } from "@/lib/data/subscription-extras";
import { stripeEnabled } from "@/lib/stripe";

/**
 * Gestionar la pròpia subscripció: donar-se de baixa i, si es paga amb targeta,
 * anar al portal de Stripe.
 *
 * Les dues accions comencen igual i no és casualitat: cap de les dues rep
 * l'identificador de la subscripció des del navegador. Es busca la del client
 * que hi ha a la sessió. Enviar-lo seria demanar que algú provés amb el d'un
 * altre.
 */

export type SubscriptionActionState = {
  errorCode?: "unauthorized" | "notFound" | "notCard" | "errorStripe" | "errorCancel";
  ok?: boolean;
};

async function ownSubscription() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return null;
  return getLiveSubscriptionForProfile(viewer.id);
}

/**
 * Baixa a final de període: es conserva el mes que ja s'ha pagat i no n'hi
 * haurà cap més.
 *
 * Amb targeta cal avisar Stripe, que és qui cobra; si no, seguiria facturant
 * cada mes encara que aquí ho donéssim per tancat. L'ordre importa: primer
 * Stripe i després la nostra fila, perquè si Stripe falla no ens quedem dient
 * que està donada de baixa mentre segueix cobrant.
 *
 * El tancament de debò no es fa aquí: arriba quan el període s'acaba —pel cron,
 * si es paga al centre; pel webhook, si es paga amb targeta—. Fins aleshores el
 * client conserva les sessions que ja té.
 */
// `useActionState` exigeix rebre l'estat anterior encara que no ens digui res:
// aquestes dues accions no llegeixen cap camp del formulari, perquè la
// subscripció surt de la sessió i no del navegador.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cancelSubscriptionAction(_prev: SubscriptionActionState): Promise<SubscriptionActionState> {
  const subscription = await ownSubscription();
  if (!subscription) return { errorCode: "notFound" };
  if (subscription.cancelAtPeriodEnd) return { ok: true };

  try {
    if (subscription.stripeSubscriptionId)
      await scheduleStripeCancellation(subscription.stripeSubscriptionId);
    await updateSubscription(subscription.id, { cancelAtPeriodEnd: true });
  } catch (e) {
    console.error("[subscripcions] no s'ha pogut programar la baixa:", e);
    return { errorCode: "errorCancel" };
  }

  revalidatePath("/client/bonos/meus");
  return { ok: true };
}

/**
 * Al portal de Stripe: canviar la targeta, veure els rebuts, donar-se de baixa.
 *
 * No en fem una pantalla pròpia perquè tocar dades de targeta ens tornaria a
 * ficar dins l'abast de PCI, que és precisament el que evita fer servir Checkout
 * allotjat. El que passi allà torna pel webhook.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function openBillingPortalAction(_prev: SubscriptionActionState): Promise<SubscriptionActionState> {
  const subscription = await ownSubscription();
  if (!subscription) return { errorCode: "notFound" };
  if (!subscription.stripeCustomerId) return { errorCode: "notCard" };

  const result = await openBillingPortal({
    stripeCustomerId: subscription.stripeCustomerId,
    returnPath: "/client/bonos/meus",
  });
  if ("error" in result) return { errorCode: "errorStripe" };

  // Fora del try, com a la resta: `redirect` llança una excepció de control que
  // Next intercepta, i dins d'un catch la llegiríem com un error nostre.
  redirect(result.url);
}


// ─── Sessions extra ─────────────────────────────────────────────────────────

export type ExtraState = {
  /** Codi del motiu pel qual no s'ha pogut. El text el posa la pantalla. */
  errorCode?: ExtraRefusal | "unauthorized" | "errorStripe";
  ok?: boolean;
};

/**
 * Demanar una sessió extra i pagar-la AL CENTRE.
 *
 * La reclamació i el pagament són dues coses separades: el bo neix pendent (la
 * plaça de la quota ja és seva) i es cobra quan passi pel centre, com qualsevol
 * altre bo pendent.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function claimExtraAtCenterAction(_prev: ExtraState): Promise<ExtraState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const claim = await claimExtraSession({ profileId: viewer.id });
  if (!claim.ok) return { errorCode: claim.reason };

  revalidatePath("/client/bonos/meus");
  return { ok: true };
}

/**
 * El mateix, pagant amb targeta.
 *
 * Es reclama PRIMER i es cobra després, que és l'ordre invers al de la compra
 * d'un bo. El motiu és a la 0073: la plaça dins de la quota del mes s'ha de
 * reservar de manera atòmica, i si esperéssim al webhook el client podria pagar
 * i trobar-se que entremig se li ha exhaurit el límit.
 *
 * Si obrir el Checkout falla, el bo es queda pendent i sempre es pot pagar al
 * centre: no es perd la sessió que ja té reclamada.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function claimExtraByCardAction(_prev: ExtraState): Promise<ExtraState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };
  if (!stripeEnabled()) return { errorCode: "errorStripe" };

  const subscription = await ownSubscription();
  if (!subscription) return { errorCode: "noSubscription" };

  const claim = await claimExtraSession({ profileId: viewer.id });
  if (!claim.ok) return { errorCode: claim.reason };

  const result = await startExtraCheckout({
    bonoId: claim.bonoId,
    clientId: subscription.clientId,
    serviceType: subscription.serviceType,
    price: claim.price,
    email: viewer.email || null,
  });
  if ("error" in result) {
    revalidatePath("/client/bonos/meus");
    return { errorCode: "errorStripe" };
  }

  redirect(result.url);
}
