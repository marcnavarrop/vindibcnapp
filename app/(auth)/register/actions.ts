"use server";

import { recordConsent } from "@/lib/data/consents";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
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
    objective: null, avatar_path: null,
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

/**
 * Motius pels quals una alta no tira endavant. Codis i no frases: la pantalla
 * es veu en tres idiomes i qui decideix el motiu és el servidor.
 */
export type RegisterErrorCode =
  | "noName"
  | "badEmail"
  | "noPhone"
  | "shortPassword"
  | "passwordMismatch";

/**
 * Valida l'alta ABANS de crear res.
 *
 * L'ordre importa: si això corregués després del `signUp`, un telèfon buit
 * deixaria un compte creat a Auth i un perfil a mitges que ningú ha demanat.
 * Validant primer, quan alguna cosa no quadra no s'ha creat res.
 *
 * Els atributs `required` de l'HTML són una comoditat per a qui omple el
 * formulari, no un control: es desactiven amb dues línies a la consola del
 * navegador. La comprovació que mana és aquesta.
 *
 * Sí, la contrasenya i la seva confirmació viatgen fins aquí. És l'única
 * manera de comprovar al servidor que coincideixen, i és el mateix camí que ja
 * fan cap a Supabase Auth dues línies més avall: HTTPS i prou. No s'escriuen
 * enlloc ni es registren.
 */
export async function validateRegistrationAction(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
}): Promise<{ errorCode?: RegisterErrorCode }> {
  if (!input.fullName.trim()) return { errorCode: "noName" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim()))
    return { errorCode: "badEmail" };
  if (!input.phone.trim()) return { errorCode: "noPhone" };
  if (input.password.length < 6) return { errorCode: "shortPassword" };
  if (input.password !== input.passwordConfirm)
    return { errorCode: "passwordMismatch" };
  return {};
}

/**
 * Desa al perfil les dades que el registre demana i que no van al `signUp`.
 *
 * Actua sobre l'usuari AUTENTICAT per la sessió, mai sobre un id que arribi del
 * navegador: just després del `signUp` (amb la confirmació per correu
 * desactivada) ja hi ha sessió, i és el mateix criteri que
 * `notifyNewRegistrationAction`. Amb un id per paràmetre, qualsevol podria
 * escriure el telèfon o la data de naixement al perfil d'un altre.
 *
 * Best-effort com els avisos: si falla, el compte ja existeix i aquestes dades
 * es poden completar a Configuració, que és el mateix formulari.
 */
export async function completeRegistrationProfileAction(input: {
  phone: string;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  gender: string;
  emergencyContact: string;
}): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;

  const { getProfileSettings, updateProfileSettings } = await import(
    "@/lib/data/clients"
  );
  const num = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const gender =
    input.gender === "home" ||
    input.gender === "dona" ||
    input.gender === "altre" ||
    input.gender === "ns_nc"
      ? input.gender
      : null;

  const current = await getProfileSettings(viewer.id);
  await updateProfileSettings(viewer.id, {
    fullName: current?.fullName ?? "",
    phone: input.phone.trim() || null,
    // L'idioma ja el va desar el trigger amb el que es va triar al selector.
    preferredLanguage: current?.preferredLanguage ?? "ca",
    birthDate: input.birthDate.trim() || null,
    heightCm: num(input.heightCm),
    weightKg: num(input.weightKg),
    gender,
    emergencyContact: input.emergencyContact.trim() || null,
    // "Objectiu" no es demana a l'alta: es queda a Configuració.
    objective: current?.objective || null,
  });
}
