"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { markGiftVoucherPaid, cancelGiftVoucher } from "@/lib/data/gift-vouchers";

/**
 * Marcar un val com a pagat és el que el fa bescanviable. El rol es comprova
 * aquí a més de la RLS: una server action és una adreça pública com qualsevol
 * altra.
 */
export async function markGiftVoucherPaidAction(formData: FormData) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return;

  const id = String(formData.get("voucherId") ?? "");
  if (!id) return;
  await markGiftVoucherPaid(id);
  revalidate();
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
