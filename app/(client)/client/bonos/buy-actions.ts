"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createPendingBono } from "@/lib/data/bonos";
import { startBonoCheckout, startSubscriptionCheckout } from "@/lib/data/stripe-checkout";
import { subscribeAtCenter } from "@/lib/data/subscription-renewal";
import { stripeEnabled } from "@/lib/stripe";
import { redirect } from "next/navigation";

/**
 * Els errors viatgen com a CODI, no com a frase: aquesta acció corre al
 * servidor i no sap en quin idioma llegeix el client. El text el posa el
 * formulari, que sí que ho sap.
 */
export type FormState = {
  errorCode?: "unauthorized" | "errorService" | "errorCreate";
  ok?: boolean;
};

/**
 * El cliente "compra" un bono para pagar en el centro: se crea en
 * 'pending_payment'. Validación + escritura con service_role en
 * createPendingBono (el cliente solo envía el serviceId).
 */
export async function createPendingBonoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { errorCode: "errorService" };

  try {
    await createPendingBono({ profileId: viewer.id, serviceId });
  } catch (e) {
    console.error("[bonos] no s'ha pogut crear el bo:", e);
    return { errorCode: "errorCreate" };
  }

  revalidatePath("/client/bonos/meus");
  return { ok: true };
}

export type CheckoutState = {
  errorCode?: "unauthorized" | "errorStripeOff" | "errorService" | "errorStripe";
};

/**
 * Pagar el bo amb targeta: obre la sessió de Stripe i hi envia el client.
 *
 * Aquí NO es crea cap bo. El bo neix al webhook, quan Stripe confirma que ha
 * cobrat: si el client tanca la pestanya a la pàgina de pagament no queda res
 * penjat, i si paga, el bo apareix encara que mai torni a l'app.
 *
 * El `redirect()` va fora del try: llança una excepció de control que Next
 * intercepta per fer la redirecció, i si quedés dins del catch la llegiríem com
 * un error nostre i el client no aniria enlloc.
 */
export async function startBonoCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  // Es torna a comprovar al servidor: que el botó no es vegi no impedeix cridar
  // l'acció directament.
  if (!stripeEnabled())
    return { errorCode: "errorStripeOff" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { errorCode: "errorService" };

  let result;
  try {
    result = await startBonoCheckout({
      profileId: viewer.id,
      serviceId,
      email: viewer.email || null,
    });
  } catch (e) {
    console.error("[bonos] no s'ha pogut obrir el pagament:", e);
    return { errorCode: "errorStripe" };
  }

  if ("error" in result) return { errorCode: "errorStripe" };
  redirect(result.url);
}

export type SubscribeState = {
  errorCode?: "unauthorized" | "errorService" | "errorSubscribe";
  ok?: boolean;
};

/**
 * El client es subscriu a un bo de grup, pagant al centre.
 *
 * Crea la subscripció I el bo del primer mes d'una tacada: a partir d'aquí, el
 * mes u i el mes catorze passen exactament pel mateix camí. Com qualsevol bo
 * pendent de pagament, les sessions ja es poden fer servir per reservar de
 * seguida.
 *
 * Tota la validació —que el centre les tingui obertes, que el paquet sigui de
 * grup, que no en tingui ja una de viva— viu al servidor, a `subscribeAtCenter`.
 * Aquí només s'hi comprova qui truca.
 */
export async function subscribeAtCenterAction(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { errorCode: "errorService" };

  try {
    await subscribeAtCenter({ profileId: viewer.id, serviceId });
  } catch (e) {
    console.error("[subscripcions] no s'ha pogut donar d'alta:", e);
    return { errorCode: "errorSubscribe" };
  }

  revalidatePath("/client/bonos/meus");
  return { ok: true };
}

/**
 * Subscriure's PAGANT AMB TARGETA: obre el Checkout en mode subscripció.
 *
 * Com amb el bo, aquí no es crea res. La subscripció neix quan Stripe emet i
 * cobra la primera factura, i ho diu pel webhook: si el client tanca la pestanya
 * abans de pagar, no queda res penjat.
 */
export async function startSubscriptionCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };
  if (!stripeEnabled()) return { errorCode: "errorStripeOff" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { errorCode: "errorService" };

  let result;
  try {
    result = await startSubscriptionCheckout({
      profileId: viewer.id,
      serviceId,
      email: viewer.email || null,
    });
  } catch (e) {
    console.error("[subscripcions] no s'ha pogut obrir el pagament:", e);
    return { errorCode: "errorStripe" };
  }

  if ("error" in result) return { errorCode: "errorStripe" };
  redirect(result.url);
}
