import "server-only";
import { cache } from "react";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Els comptes demo, segons la BASE (`demo_profiles`, 0110).
 *
 * És la mateixa font que fa servir `same_world()` a la RLS de l'historial
 * clínic: aquí no hi ha cap llista nova. Serveix perquè els números de l'Inici
 * de l'admin siguin els del centre de debò: abans hi entraven els pagaments de
 * prova del Client Demo (el 88 % dels ingressos d'octubre del 2026), els seus
 * bons i la disponibilitat de l'Entrenador Demo i el Fisio Demo.
 *
 * `demo_profiles` no la pot llegir cap sessió (revoke a `authenticated`), així
 * que es llegeix amb la clau de servei, NOMÉS al servidor i només per saber
 * quins ids són demo. Amb `React.cache`: una lectura per petició.
 *
 * En simulació no hi ha `demo_profiles`: el món demo és buit i els números no
 * canvien.
 */
export type DemoWorld = {
  /** Perfils demo (professionals i clients). */
  profileIds: Set<string>;
  /** Fitxes `clients` dels perfils demo. */
  clientIds: Set<string>;
};

export const getDemoWorld = cache(async (): Promise<DemoWorld> => {
  const empty: DemoWorld = { profileIds: new Set(), clientIds: new Set() };
  if (USE_MOCK) return empty;
  try {
    const admin = createAdminClient();
    const { data: demo, error } = await admin.from("demo_profiles").select("profile_id").limit(100);
    if (error) throw error;
    const profileIds = new Set((demo ?? []).map((d) => d.profile_id as string));
    if (profileIds.size === 0) return empty;
    const { data: clients, error: cErr } = await admin
      .from("clients")
      .select("id")
      .in("profile_id", [...profileIds])
      .limit(100);
    if (cErr) throw cErr;
    return { profileIds, clientIds: new Set((clients ?? []).map((c) => c.id as string)) };
  } catch (e) {
    // Sense saber quins són demo, millor els números amb demo que cap número:
    // es registra i l'Inici es pinta igual.
    console.error("[demo-world] no s'han pogut llegir els comptes demo:", e instanceof Error ? e.message : e);
    return empty;
  }
});

/** La reserva, el bo o el pagament és del món demo (client o professional demo). */
export function isDemoRow(w: DemoWorld, row: { clientId?: string | null; trainerId?: string | null }): boolean {
  return (!!row.clientId && w.clientIds.has(row.clientId)) || (!!row.trainerId && w.profileIds.has(row.trainerId));
}
