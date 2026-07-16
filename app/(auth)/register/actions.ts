"use server";

import { recordConsent } from "@/lib/data/consents";
import { createClient } from "@/lib/supabase/server";
import { onNewClientRegistered } from "@/lib/data/registration";

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

/**
 * Post-registre: email de benvinguda al client + avís de nou client a l'admin.
 * Per seguretat NO confia en cap id del navegador: actua sobre l'usuari
 * autenticat per la sessió (tras el signUp, amb "Confirm email" desactivat, ja
 * hi ha sessió). Best-effort: no trenca el registre.
 */
export async function notifyNewRegistrationAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await onNewClientRegistered(user.id);
}
