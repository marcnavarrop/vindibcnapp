"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  bonoBelongsTo,
  createPayment,
  listBonosForPayment,
  listPayments,
  type PaymentBono,
} from "@/lib/data/payments";
import { getViewer } from "@/lib/auth";
import { toPaymentRow, type PaymentRowView } from "@/lib/payment-row";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { PaymentMethod } from "@/types/database";

export async function createPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Aquesta pantalla és de l'admin. Fins ara l'acció no ho mirava i ho deixava
  // tot a la RLS de `payments`, que també deixa anotar cobraments als
  // professionals (0085): ara ho diu l'acció mateixa.
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const clientId = String(formData.get("clientId") ?? "");
  const bonoId = String(formData.get("bonoId") ?? "") || null;
  const amount = Number(formData.get("amount"));
  const rawMethod = String(formData.get("method") ?? "");

  if (!clientId) return { error: "Tria un client." };
  if (!Number.isFinite(amount) || amount < 0)
    return { error: "L'import no és vàlid." };
  if (rawMethod !== "card" && rawMethod !== "cash")
    return { error: "Tria un mètode de pagament." };
  const method = rawMethod as PaymentMethod;

  try {
    // Els bons arriben al navegador DESPRÉS de triar el client: si s'ha canviat
    // de client entremig, el bo triat podria ser de l'anterior.
    if (bonoId && !(await bonoBelongsTo(bonoId, clientId)))
      return { error: "Aquest bo no és del client triat. Torna a triar el bo." };
    await createPayment({ clientId, bonoId, amount, method });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en registrar el pagament." };
  }

  revalidatePath("/admin/pagos");
  redirect("/admin/pagos");
}

export type LoadMorePaymentsResult =
  | { ok: true; rows: PaymentRowView[]; nextCursor: string | null }
  | { ok: false; error: string };

/** «Carregar més»: la pàgina següent de la llista de pagaments. Només admin. */
export async function loadMorePaymentsAction(
  cursor: string,
): Promise<LoadMorePaymentsResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { ok: false, error: "No autoritzat." };
  try {
    const page = await listPayments({ cursor });
    return {
      ok: true,
      rows: page.items.map(toPaymentRow),
      nextCursor: page.nextCursor,
    };
  } catch (e) {
    console.error("[pagaments] carregar més:", e);
    return { ok: false, error: "No s'han pogut carregar més pagaments. Torna-ho a provar." };
  }
}

export type PaymentBonosResult =
  | { ok: true; bonos: PaymentBono[] }
  | { ok: false; error: string };

/** Els bons del client triat a «+ Nou pagament». Només admin. */
export async function paymentBonosAction(clientId: string): Promise<PaymentBonosResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { ok: false, error: "No autoritzat." };
  if (typeof clientId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(clientId))
    return { ok: false, error: "Client no vàlid." };
  try {
    return { ok: true, bonos: await listBonosForPayment(clientId) };
  } catch (e) {
    console.error("[pagaments] bons del client:", e);
    return { ok: false, error: "No s'han pogut carregar els bons d'aquest client." };
  }
}
