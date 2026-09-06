"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  getSubscription,
  updateSubscription,
} from "@/lib/data/subscriptions";
import { notifySubscriptionCancelled } from "@/lib/data/subscription-notify";
import { scheduleStripeCancellation } from "@/lib/data/stripe-checkout";
import { centerToday } from "@/lib/center-time";

/**
 * Les dues accions que l'admin pot fer sobre una subscripció.
 *
 * NO n'hi ha cap de "pausar", i és deliberat: 'past_due' ja vol dir "aturada
 * fins que pagui" i el client ho llegeix així. Una pausa decidida pel centre és
 * un fet DIFERENT —no deu res— i mereixeria el seu propi estat a l'enum, o
 * sigui una migració i una decisió sobre què se li diu al client. Fer-la passar
 * per 'past_due' seria acusar d'impagament algú que està al corrent.
 */

export type AdminSubscriptionState = { error?: string; ok?: string };

async function admin() {
  const viewer = await getViewer();
  return viewer?.role === "admin" ? viewer : null;
}

/**
 * Dona de baixa una subscripció al final del període que el client ja té pagat.
 *
 * Mai a l'instant: el mes ja s'ha cobrat i les seves sessions són seves. És el
 * mateix criteri que la baixa que demana el client.
 *
 * Amb targeta cal avisar Stripe TAMBÉ, o seguiria cobrant cada mes contra una
 * fila que aquí ja no es renova. Si Stripe falla, no es toca res nostre: val
 * més una baixa que no s'ha aplicat i es pot repetir que una fila que diu
 * "cancel·lada" mentre el banc segueix cobrant.
 */
export async function adminCancelSubscriptionAction(
  _prev: AdminSubscriptionState,
  fd: FormData,
): Promise<AdminSubscriptionState> {
  if (!(await admin())) return { error: "No autoritzat." };

  const id = String(fd.get("subscriptionId") ?? "");
  const sub = await getSubscription(id);
  if (!sub) return { error: "Subscripció no trobada." };
  if (sub.status === "cancelled") return { error: "Ja estava cancel·lada." };

  if (sub.paymentMethod === "card" && sub.stripeSubscriptionId) {
    try {
      await scheduleStripeCancellation(sub.stripeSubscriptionId);
    } catch (e) {
      console.error("[admin] Stripe no ha acceptat la baixa:", e);
      return { error: "Stripe no ha acceptat la baixa. No s'ha canviat res." };
    }
  }

  await updateSubscription(id, { cancelAtPeriodEnd: true });
  revalidatePath("/admin/subscripcions");
  return { ok: "La subscripció no es renovarà. El mes ja pagat es conserva." };
}

/**
 * Canvia el preu mensual.
 *
 * El preu es congela a l'alta i no es torna a cotitzar mai (0072), i això és
 * el que protegeix el client d'una pujada automàtica. Aquesta és la sortida
 * d'emergència per a quan el centre i el client pacten un altre import: es fa a
 * mà, una subscripció concreta, i queda dit qui ho ha fet.
 *
 * NOMÉS afecta els cicles següents. El bo del mes en curs ja porta el preu amb
 * què es va emetre, i canviar-lo ara seria reescriure una venda tancada.
 *
 * Amb targeta NO es toca res a Stripe: allà el preu viu a la subscripció de
 * Stripe i canviar-lo és una operació seva. Per això aquesta acció es limita a
 * les que es paguen al centre, i ho diu.
 */
export async function adminChangePriceAction(
  _prev: AdminSubscriptionState,
  fd: FormData,
): Promise<AdminSubscriptionState> {
  if (!(await admin())) return { error: "No autoritzat." };

  const id = String(fd.get("subscriptionId") ?? "");
  const price = Number(fd.get("unitPrice"));
  if (!Number.isFinite(price) || price < 0 || price > 100000)
    return { error: "El preu ha de ser un import vàlid." };

  const sub = await getSubscription(id);
  if (!sub) return { error: "Subscripció no trobada." };
  if (sub.paymentMethod === "card")
    return {
      error:
        "Aquesta es cobra amb targeta: el preu el governa Stripe i s'ha de canviar des d'allà.",
    };

  await updateSubscription(id, { unitPrice: Math.round(price * 100) / 100 });
  revalidatePath("/admin/subscripcions");
  return { ok: `Preu actualitzat. S'aplicarà a partir del ${sub.nextRenewalOn ?? centerToday()}.` };
}

/** Avisa el client d'una baixa ja consumada. Serveix per reenviar-lo. */
export async function adminNotifyCancelledAction(
  _prev: AdminSubscriptionState,
  fd: FormData,
): Promise<AdminSubscriptionState> {
  if (!(await admin())) return { error: "No autoritzat." };
  const sub = await getSubscription(String(fd.get("subscriptionId") ?? ""));
  if (!sub) return { error: "Subscripció no trobada." };
  await notifySubscriptionCancelled(sub);
  return { ok: "Avís enviat (si el client el té activat)." };
}
