"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { recordConsent } from "@/lib/data/consents";

export type FormState = { error?: string; ok?: boolean };

/**
 * El client accepta el tractament de dades de salut des de la seva àrea.
 * Es registra amb data i IP (auditoria RGPD).
 */
export async function grantHealthConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };
  if (formData.get("accept") !== "on")
    return { error: "Has de marcar la casella per acceptar." };

  try {
    await recordConsent(viewer.id, "health_data");
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "No s'ha pogut desar el consentiment.",
    };
  }

  revalidatePath("/client/configuracio");
  return { ok: true };
}
