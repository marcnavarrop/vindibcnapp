import "server-only";
import { headers } from "next/headers";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { CURRENT_CONSENT_VERSION, CURRENT_HEALTH_CONSENT_VERSION, isCurrentHealthConsent } from "@/lib/consent";

export type ConsentType = "privacy" | "health_data";

export type ConsentStatus = {
  privacyAt: string | null;
  privacyVersion: string | null;
  /** El consentiment de salut VIGENT més recent (no retirat, 0118), de qualsevol versió. */
  healthDataAt: string | null;
  healthDataVersion: string | null;
  /** Té el de salut de la versió vigent (2026-10 o posterior): el que demanen els tests. */
  healthDataCurrent: boolean;
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
  version: string = type === "health_data" ? CURRENT_HEALTH_CONSENT_VERSION : CURRENT_CONSENT_VERSION,
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
    healthDataCurrent: false,
  };

  type Row = { type: ConsentType; version: string; granted_at: string; revoked_at?: string | null };
  let rows: Row[] = [];

  if (USE_MOCK) {
    rows = getStore()
      .consents.filter((c) => c.user_id === userId)
      .map((c) => ({ type: c.type, version: c.version, granted_at: c.granted_at, revoked_at: c.revoked_at ?? null }))
      .sort((a, b) => b.granted_at.localeCompare(a.granted_at));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consents")
      .select("type, version, granted_at, revoked_at")
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
    // Un de salut retirat (0118) ja no compta.
    if (r.type === "health_data" && !r.revoked_at && !status.healthDataAt) {
      status.healthDataAt = r.granted_at;
      status.healthDataVersion = r.version;
      status.healthDataCurrent = isCurrentHealthConsent(r.version);
    }
  }
  return status;
}

/**
 * El propi usuari retira el seu consentiment de dades de salut (0118). Amb la
 * SEVA sessió: la funció de la base només marca les files de qui crida. Les
 * files es queden (són la prova de quan es va donar); se'ls posa `revoked_at`.
 */
export async function revokeHealthConsent(userId: string): Promise<number> {
  if (USE_MOCK) {
    const store = getStore();
    const now = new Date().toISOString();
    let n = 0;
    for (const c of store.consents) {
      if (c.user_id === userId && c.type === "health_data" && !c.revoked_at) {
        c.revoked_at = now;
        n++;
      }
    }
    saveStore(store);
    return n;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_health_consent");
  if (error) throw error;
  return Number(data ?? 0);
}
