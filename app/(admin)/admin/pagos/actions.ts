"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPayment } from "@/lib/data/payments";
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
