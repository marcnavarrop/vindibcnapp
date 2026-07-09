import "server-only";
import { headers } from "next/headers";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { CURRENT_CONSENT_VERSION } from "@/lib/consent";

export type ConsentType = "privacy" | "health_data";

export type ConsentStatus = {
  privacyAt: string | null;
  privacyVersion: string | null;
  healthDataAt: string | null;
  healthDataVersion: string | null;
};

async function currentIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return fwd ? fwd.split(",")[0].trim() : (h.get("x-real-ip") ?? null);
  } catch {
    return null;
  }
}

/**
 * Registra un consentiment. Fa servir service_role perquè a l'alta l'usuari
 * encara pot no estar autenticat; captura la IP per a l'auditoria RGPD.
 */
export async function recordConsent(
  userId: string,
  type: ConsentType,
  version: string = CURRENT_CONSENT_VERSION,
): Promise<void> {
  const ip = await currentIp();

  if (USE_MOCK) {
    const store = getStore();
    const now = new Date().toISOString();
    store.consents.push({
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      version,
      granted_at: now,
      ip,
      created_at: now,
    });
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("consents")
    .insert({ user_id: userId, type, version, ip });
  if (error) throw error;
}

/** Estat de consentiments d'un usuari (el més recent de cada tipus). */
export async function getConsentStatus(
  userId: string,
): Promise<ConsentStatus> {
  const empty: ConsentStatus = {
    privacyAt: null,
    privacyVersion: null,
    healthDataAt: null,
    healthDataVersion: null,
  };

  type Row = { type: ConsentType; version: string; granted_at: string };
  let rows: Row[] = [];

  if (USE_MOCK) {
    rows = getStore()
      .consents.filter((c) => c.user_id === userId)
      .map((c) => ({ type: c.type, version: c.version, granted_at: c.granted_at }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consents")
      .select("type, version, granted_at")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false });
    if (error) throw error;
    rows = (data ?? []) as Row[];
  }

  const status = { ...empty };
  for (const r of rows) {
    if (r.type === "privacy" && !status.privacyAt) {
      status.privacyAt = r.granted_at;
      status.privacyVersion = r.version;
    }
    if (r.type === "health_data" && !status.healthDataAt) {
      status.healthDataAt = r.granted_at;
      status.healthDataVersion = r.version;
    }
  }
  return status;
}

/** ¿El usuario ha consentido el tratamiento de datos de salud? */
export async function hasHealthConsent(userId: string): Promise<boolean> {
  const s = await getConsentStatus(userId);
  return s.healthDataAt !== null;
}
