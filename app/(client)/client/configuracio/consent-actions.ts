"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { recordConsent, revokeHealthConsent } from "@/lib/data/consents";

export type ConsentErrorCode = "unauthorized" | "mustAccept" | "failed";

export type FormState = { errorCode?: ConsentErrorCode; ok?: boolean };

/**
 * El client accepta el tractament de dades de salut des de la seva àrea.
 * Es registra amb data, IP i la versió vigent del text (2026-10, 0118). La
 * casella la marca el propi client: aquesta acció només la pot cridar un client.
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

  revalidateConsentPages();
  return { ok: true };
}

function revalidateConsentPages() {
  revalidatePath("/client");
  revalidatePath("/client/configuracio");
  revalidatePath("/client/consentiment");
}

export type RevokeResult = { ok: true } | { ok: false };

/**
 * El client retira el seu consentiment de dades de salut (0118), des del mateix
 * lloc on el dona. Amb la seva sessió: la base només li deixa retirar el seu.
 */
export async function revokeHealthConsentAction(): Promise<RevokeResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { ok: false };
  try {
    await revokeHealthConsent(viewer.id);
  } catch {
    return { ok: false };
  }
  revalidateConsentPages();
  return { ok: true };
}
