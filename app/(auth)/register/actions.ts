"use server";

import { recordConsent } from "@/lib/data/consents";
import { createClient } from "@/lib/supabase/server";
import { USE_MOCK } from "@/lib/config";
import { onNewClientRegistered } from "@/lib/data/registration";

/**
 * Alta en mode demo: crea el perfil al store simulat i executa el post-registre.
 * En mode demo NO es pot cridar `supabase.auth.signUp`, perquè crearia un usuari
 * real al projecte de Supabase configurat. Retorna l'id del perfil creat.
 */
export async function mockRegisterAction(input: {
  fullName: string;
  email: string;
  referralCode?: string;
}): Promise<string> {
  if (!USE_MOCK) throw new Error("Només disponible en mode demo.");

  const { getStore, saveStore } = await import("@/lib/mock/store");
  const store = getStore();

  const email = input.email.trim().toLowerCase();
  if (store.profiles.some((p) => p.email?.toLowerCase() === email))
    throw new Error("Aquest correu ja està registrat.");

  const profileId = crypto.randomUUID();
  store.profiles.push({
    id: profileId,
    email,
    full_name: input.fullName.trim(),
    phone: null,
    role: "client",
    specialty: null,
    preferred_language: "ca",
    birth_date: null,
    height_cm: null,
    weight_kg: null,
    gender: null,
    emergency_contact: null,
    objective: null,
    created_at: new Date().toISOString(),
  });
  saveStore(store);

  await onNewClientRegistered(profileId, input.referralCode);
  return profileId;
}

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
export async function notifyNewRegistrationAction(
  referralCode?: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await onNewClientRegistered(user.id, referralCode);
}
