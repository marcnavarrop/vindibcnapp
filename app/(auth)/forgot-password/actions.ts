"use server";

import { headers } from "next/headers";
import { sendPasswordRecovery } from "@/lib/notifications/auth-emails";
import { allowPasswordReset } from "@/lib/data/password-reset";

/**
 * El resultat porta un CODI, no una frase.
 *
 * Aquesta pantalla és pública i es veu en tres idiomes, i qui decideix si el
 * correu és vàlid és el servidor —que no sap ni ha de saber quina cookie
 * d'idioma porta el visitant—. La traducció la fa la pantalla, que sí que ho
 * sap. Mateix criteri que a la sessió de prova i a les reserves.
 */
export type ForgotErrorCode = "badEmail";
export type ForgotState = { ok?: boolean; errorCode?: ForgotErrorCode };

/** IP del sol·licitant a partir de les capçaleres del proxy (best-effort).
 *  Mateixa lectura que a la sessió de prova, que és l'altra porta pública. */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/**
 * Sol·licitud de restabliment de contrasenya. Genera el token amb l'Admin API i
 * envia l'email de marca via Resend. Sempre respon OK (no revela si el compte
 * existeix), tret d'un email mal format.
 *
 * EL FRE NO CANVIA LA RESPOSTA, I ÉS DELIBERAT
 *
 * Quan es frena es respon exactament el mateix `ok` que quan s'envia. Dir "has
 * fet massa intents" seria regalar el que la resposta genèrica protegeix: qui
 * volgués saber si una adreça té compte al centre només hauria de mirar quin
 * dels dos missatges rep. El fre és per a l'abús, no per informar-ne l'abusador.
 *
 * Les regles i el perquè de cadascuna, a lib/data/password-reset.ts.
 */
export async function requestPasswordResetAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/.+@.+\..+/.test(email)) return { errorCode: "badEmail" };

  if (!(await allowPasswordReset(email, await clientIp())))
    return { ok: true };

  try {
    await sendPasswordRecovery(email);
  } catch {
    // Best-effort i silenciós: no revelem res.
  }
  return { ok: true };
}
