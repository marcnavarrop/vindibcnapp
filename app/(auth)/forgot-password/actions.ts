"use server";

import { sendPasswordRecovery } from "@/lib/notifications/auth-emails";

export type ForgotState = { ok?: boolean; error?: string };

/**
 * Sol·licitud de restabliment de contrasenya. Genera el token amb l'Admin API i
 * envia l'email de marca via Resend. Sempre respon OK (no revela si el compte
 * existeix), tret d'un email mal format.
 */
export async function requestPasswordResetAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/.+@.+\..+/.test(email)) return { error: "Indica un correu vàlid." };
  try {
    await sendPasswordRecovery(email);
  } catch {
    // Best-effort i silenciós: no revelem res.
  }
  return { ok: true };
}
