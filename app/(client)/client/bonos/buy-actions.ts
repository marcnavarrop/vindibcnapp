"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createPendingBono } from "@/lib/data/bonos";
import { startBonoCheckout } from "@/lib/data/stripe-checkout";
import { stripeEnabled } from "@/lib/stripe";
import { redirect } from "next/navigation";

export type FormState = { error?: string; ok?: boolean };

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
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { error: "Tria un servei." };

  try {
    await createPendingBono({ profileId: viewer.id, serviceId });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut crear el bo.",
    };
  }

  revalidatePath("/client/bonos/meus");
  return { ok: true };
}

export type CheckoutState = { error?: string };

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
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  // Es torna a comprovar al servidor: que el botó no es vegi no impedeix cridar
  // l'acció directament.
  if (!stripeEnabled())
    return { error: "El pagament amb targeta no està disponible ara mateix." };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { error: "Tria un servei." };

  let result;
  try {
    result = await startBonoCheckout({
      profileId: viewer.id,
      serviceId,
      email: viewer.email || null,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut iniciar el pagament.",
    };
  }

  if ("error" in result) return { error: result.error };
  redirect(result.url);
}
