"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { setBonoAutoRenew, type AutoRenewBlock } from "@/lib/data/bonos";
import { startPendingBonoCheckout } from "@/lib/data/stripe-checkout";
import { stripeEnabled } from "@/lib/stripe";

/**
 * El que el client pot fer amb un bo que ja té: encendre-li la renovació
 * automàtica i pagar-lo si està pendent.
 *
 * Els motius viatgen com a CODI i no com a frase, com a la resta d'accions
 * d'aquesta àrea: això corre al servidor i no sap en quin idioma es llegeix.
 */

export type AutoRenewState = {
  errorCode?: AutoRenewBlock | "unauthorized" | "failed";
  ok?: boolean;
  /** Com ha quedat l'interruptor, per si la pantalla l'ha de corregir. */
  on?: boolean;
};

/**
 * Encén o apaga la renovació automàtica d'un bo del client.
 *
 * El `bonoId` arriba del formulari però la PROPIETAT la comprova
 * `setBonoAutoRenew` contra el perfil de la sessió: qui enviï l'id d'un bo
 * d'altri no n'obtindrà res.
 */
export async function toggleAutoRenewAction(
  _prev: AutoRenewState,
  formData: FormData,
): Promise<AutoRenewState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const bonoId = String(formData.get("bonoId") ?? "");
  const on = String(formData.get("on") ?? "") === "true";
  if (!bonoId) return { errorCode: "failed" };

  try {
    const res = await setBonoAutoRenew({ profileId: viewer.id, bonoId, on });
    if (!res.ok) return { errorCode: res.reason, on: !on };
    revalidatePath("/client/bonos/meus");
    return { ok: true, on };
  } catch (e) {
    console.error("[bonos] renovació automàtica:", e);
    return { errorCode: "failed", on: !on };
  }
}

export type PayPendingState = {
  errorCode?: "unauthorized" | "errorStripeOff" | "errorStripe" | "errorBono";
};

/**
 * Obre el pagament amb targeta d'un bo que ja existeix i està pendent.
 *
 * AIXÒ NO CREA CAP BO, I ÉS L'EXCEPCIÓ QUE CALIA
 *
 * La regla de la casa és que prémer «pagar amb targeta» no crea res i que el bo
 * neix al webhook. Aquí el bo ja hi és —l'ha fet néixer «pagar al centre» o la
 * renovació automàtica— i el webhook el que fa és ADOPTAR-LO. Sense aquest
 * camí, pagar un pendent amb targeta n'hauria creat un segon.
 *
 * El `redirect()` va fora del try pel mateix motiu que a `buy-actions.ts`:
 * llança una excepció de control que Next intercepta, i dins del catch la
 * llegiríem com un error nostre.
 */
export async function payPendingBonoAction(
  _prev: PayPendingState,
  formData: FormData,
): Promise<PayPendingState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };
  if (!stripeEnabled()) return { errorCode: "errorStripeOff" };

  const bonoId = String(formData.get("bonoId") ?? "");
  if (!bonoId) return { errorCode: "errorBono" };

  let result;
  try {
    result = await startPendingBonoCheckout({
      profileId: viewer.id,
      bonoId,
      email: viewer.email || null,
    });
  } catch (e) {
    console.error("[bonos] no s'ha pogut obrir el pagament del pendent:", e);
    return { errorCode: "errorStripe" };
  }

  if ("error" in result) return { errorCode: "errorStripe" };
  redirect(result.url);
}
