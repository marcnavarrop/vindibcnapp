"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBono, markBonoPaid, cancelBono } from "@/lib/data/bonos";
import { subscribeAtCenter } from "@/lib/data/subscription-renewal";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType, PaymentMethod } from "@/types/database";

export async function createBonoAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const serviceType = formData.get("serviceType") as ServiceType | null;
  const totalSessions = Number(formData.get("totalSessions"));
  const price = Number(formData.get("price"));
  const rawMethod = String(formData.get("paymentMethod") ?? "cash");

  if (!serviceType) return { error: "Tria un servei." };
  if (!Number.isFinite(totalSessions) || totalSessions <= 0)
    return { error: "El nre. de sessions ha de ser més gran que 0." };
  if (!Number.isFinite(price) || price < 0)
    return { error: "El preu no és vàlid." };

  const paymentMethod: PaymentMethod | null =
    rawMethod === "card" ? "card" : rawMethod === "cash" ? "cash" : null;

  try {
    await createBono({ clientId, serviceType, totalSessions, price, paymentMethod });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear el bo." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/bonos");
  revalidatePath("/admin/pagos");
  redirect(`/admin/clients/${clientId}`);
}

/**
 * L'admin subscriu un client a un paquet de grup, pagant al centre.
 *
 * És l'altra meitat de `createBonoAction`, i no un afegit: des que el grup
 * només es pot tenir per subscripció, aquesta és l'ÚNICA manera de donar-li
 * sessions de grup a algú des del taulell. El formulari canvia de cara quan es
 * tria un paquet de grup i acaba aquí.
 *
 * Passa exactament per on passa el client quan es subscriu ell mateix
 * (`subscribeAtCenter`): mateix preu congelat, mateixa àncora al dia d'avui,
 * mateix bo del primer mes pendent de pagar. El client no ha de poder notar qui
 * va prémer el botó.
 *
 * NO REGISTRA CAP COBRAMENT, i és la diferència amb l'alta d'un bo solt, on
 * l'admin pot triar «Efectiu». El bo del mes neix 'pending_payment' i es cobra
 * des de Bons quan el client pagui, com qualsevol altre mes de subscripció. Si
 * aquí s'anotés el pagament, el primer mes aniria per un camí i els següents per
 * un altre.
 */
export async function createGroupSubscriptionAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { error: "Tria un paquet." };

  try {
    await subscribeAtCenter({ clientId, serviceId });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en donar d'alta la subscripció.",
    };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/bonos");
  revalidatePath("/admin/subscripcions");
  redirect(`/admin/clients/${clientId}`);
}

/** Marca un bono pendiente como pagado (en efectivo, en el centro). */
export async function markBonoPaidAction(formData: FormData) {
  const bonoId = String(formData.get("bonoId") ?? "");
  if (!bonoId) return;
  await markBonoPaid(bonoId);
  revalidatePath("/admin/bonos");
  revalidatePath("/admin/pagos");
}

/**
 * L'admin anul·la un bo. `isAdmin: true` és el que li deixa anul·lar també els
 * ja cobrats, que al professional li reboten: deixar diners al llibre sense res
 * que ho compensi és una esmena comptable i és seva.
 *
 * El cobrament NO es toca. La devolució, si n'hi ha d'haver, es fa fora de
 * l'app: `payments.amount` té un CHECK (amount >= 0) i esborrar la fila
 * trencaria l'històric que la 0016 va decidir conservar.
 */
export async function cancelBonoAction(formData: FormData) {
  const bonoId = String(formData.get("bonoId") ?? "");
  if (!bonoId) return;
  await cancelBono(bonoId, { isAdmin: true });
  revalidatePath("/admin/bonos");
  revalidatePath("/admin/pagos");
}
