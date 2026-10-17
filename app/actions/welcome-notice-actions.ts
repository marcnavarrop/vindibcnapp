"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getConsentStatus, recordConsent } from "@/lib/data/consents";
import { confirmCommunityNotice, getCommunityNotice } from "@/lib/data/community-notice";

export type WelcomeNoticeState = { ok?: boolean; error?: "unauthorized" | "failed" };

/**
 * La targeta del primer accés (0124): el client que ha creat l'admin (o que ve
 * d'una sessió de prova) no ha passat pel registre, i aquí se li diu el que el
 * registre diu.
 *
 *   · La política de privacitat (art. 14 RGPD), si encara no en consta cap:
 *     es desa que l'ha vista, amb la versió vigent.
 *   · Les novetats del centre per correu (art. 21.2 LSSI), si encara no se li
 *     ha dit: es desa el que ha triat a la casella.
 *
 * Només el client de la sessió, i només el que té pendent: res d'això es pot
 * fer per a una altra persona.
 */
export async function confirmWelcomeNoticeAction(
  _prev: WelcomeNoticeState,
  fd: FormData,
): Promise<WelcomeNoticeState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { error: "unauthorized" };
  try {
    const [consent, notice] = await Promise.all([getConsentStatus(viewer.id), getCommunityNotice(viewer.id)]);
    if (!consent.privacyAt) await recordConsent(viewer.id, "privacy");
    if (notice.pending) await confirmCommunityNotice(viewer.id, fd.get("communityEmail") === "on");
  } catch {
    return { error: "failed" };
  }
  revalidatePath("/client");
  revalidatePath("/client/configuracio");
  return { ok: true };
}
