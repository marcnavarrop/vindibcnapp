"use server";

import { recordConsent } from "@/lib/data/consents";

/**
 * Registra el consentiment de la Política de Privacitat + Avís Legal a l'alta.
 * Es crida just després del signUp amb l'id del nou usuari. Fa servir
 * service_role (l'usuari pot no estar encara autenticat si hi ha confirmació
 * per email) i captura la IP per a l'auditoria.
 */
export async function recordRegistrationConsentAction(
  userId: string,
): Promise<void> {
  if (!userId) return;
  await recordConsent(userId, "privacy");
}
