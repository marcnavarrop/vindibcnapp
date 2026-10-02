"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { markGiftVoucherPaid, cancelGiftVoucher } from "@/lib/data/gift-vouchers";
import { parseCounterMethod, BAD_METHOD } from "@/lib/counter-payment";
import type { MarkPaidState } from "@/components/forms/mark-bono-paid-button";

/**
 * Marcar un val com a pagat és el que el fa bescanviable. El rol es comprova
 * aquí a més de la RLS: una server action és una adreça pública com qualsevol
 * altra.
 */
export async function markGiftVoucherPaidAction(
  _prev: MarkPaidState,
  formData: FormData,
): Promise<MarkPaidState> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return { error: "No autoritzat." };

  const id = String(formData.get("voucherId") ?? "");
  if (!id) return { error: "Falta el val." };
  const method = parseCounterMethod(formData.get("method"));
  if (!method) return { error: BAD_METHOD };
  try {
    await markGiftVoucherPaid(id, method);
  } catch (e) {
    // Com als bons: el motiu a la pantalla, no la pàgina d'error genèrica.
    return { error: e instanceof Error ? e.message : "No s'ha pogut cobrar." };
  }
  revalidate();
  return { error: null, done: true };
}

export async function cancelGiftVoucherAction(formData: FormData) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return;

  const id = String(formData.get("voucherId") ?? "");
  if (!id) return;
  await cancelGiftVoucher(id);
  revalidate();
}

function revalidate() {
  revalidatePath("/admin/vals-regal");
  // Cobrar un val hi apunta un pagament, i el panell d'inici en compta els
  // ingressos del mes.
  revalidatePath("/admin/pagos");
  revalidatePath("/admin");
}
