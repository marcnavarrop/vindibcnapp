"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPayment, listPayments } from "@/lib/data/payments";
import { getViewer } from "@/lib/auth";
import { toPaymentRow, type PaymentRowView } from "@/lib/payment-row";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { PaymentMethod } from "@/types/database";

export async function createPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
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
