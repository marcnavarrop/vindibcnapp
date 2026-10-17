import "server-only";
import { cache } from "react";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { REAL_WORLD, type DemoWorld } from "@/lib/demo-accounts";
import { mockFails } from "@/lib/mock/faults";

export type { DemoWorld };

/**
 * Els comptes demo, segons la BASE (`demo_profiles`), l'única font des de la
 * 0121. La mateixa que fa servir `same_world()` a la RLS.
 *
 * `demo_world()` els torna en UNA consulta (perfil i, si en té, la fitxa de
 * client). Només la pot cridar la clau de servei, i només es crida al
 * servidor. Amb `React.cache`: una lectura per petició, i només a les pantalles
 * i accions que la necessiten (reservar, assignar, historial, /prova, Inici).
 *
 * SI FALLA, TOTHOM ÉS REAL. Es registra l'error i es torna el món buit: cap
 * compte es tracta com a demo per error. La base continua separant els mons
 * on ho fa ella (`same_world` a l'historial clínic i els tests), i el mode PRE
 * no deixa saltar enlloc (no pot confirmar que el compte sigui demo).
 *
 * En simulació es llegeix la col·lecció `demo_profiles` del magatzem (buida a la
 * llavor: els scripts hi posen els comptes demo quan els cal).
 */
export const getDemoWorld = cache(async (): Promise<DemoWorld> => {
  if (USE_MOCK) {
    // Per provar que, sense poder llegir, tothom és real: MOCK_FAIL=demo_world.
    if (mockFails("demo_world")) {
      console.error("[demo-world] no s'han pogut llegir els comptes demo: simulat");
      return REAL_WORLD;
    }
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const profileIds = new Set(store.demo_profiles.map((d) => d.profile_id));
    const clientIds = new Set(store.clients.filter((c) => profileIds.has(c.profile_id)).map((c) => c.id));
    return { profileIds, clientIds };
  }
  try {
    const { data, error } = await createAdminClient().rpc("demo_world");
    if (error) throw error;
    const rows = data ?? [];
    return {
      profileIds: new Set(rows.map((r) => r.profile_id)),
      clientIds: new Set(rows.flatMap((r) => (r.client_id ? [r.client_id] : []))),
    };
  } catch (e) {
    console.error("[demo-world] no s'han pogut llegir els comptes demo:", e instanceof Error ? e.message : e);
    return REAL_WORLD;
  }
});

/** La reserva, el bo o el pagament és del món demo (client o professional demo). */
export function isDemoRow(w: DemoWorld, row: { clientId?: string | null; trainerId?: string | null }): boolean {
  return (!!row.clientId && w.clientIds.has(row.clientId)) || (!!row.trainerId && w.profileIds.has(row.trainerId));
}
