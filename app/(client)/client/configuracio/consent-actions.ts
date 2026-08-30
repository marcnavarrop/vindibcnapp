"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { recordConsent } from "@/lib/data/consents";

export type ConsentErrorCode = "unauthorized" | "mustAccept" | "failed";

export type FormState = { errorCode?: ConsentErrorCode; ok?: boolean };

/**
 * El client accepta el tractament de dades de salut des de la seva àrea.
 * Es registra amb data i IP (auditoria RGPD).
 */
export async function grantHealthConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };
  if (formData.get("accept") !== "on")
    return { errorCode: "mustAccept" };

  try {
    await recordConsent(viewer.id, "health_data");
  } catch {
    return { errorCode: "failed" };
  }

  revalidatePath("/client/configuracio");
  return { ok: true };
}
