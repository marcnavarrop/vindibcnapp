"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createPendingBono } from "@/lib/data/bonos";

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

  revalidatePath("/client/bonos");
  return { ok: true };
}
