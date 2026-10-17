import "server-only";
import { cache } from "react";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";

/**
 * Els perfils DONATS DE BAIXA (desactivats, 0128): `profiles.deactivated_at`.
 *
 * Un professional desactivat no pot entrar, no surt a l'agenda ni als
 * selectors, la seva disponibilitat no s'ofereix (ni a /prova) i no rep els
 * correus de l'equip. El seu historial es queda amb el seu nom: per això no
 * es filtra on només cal el NOM (llistes de reserves passades, liquidacions).
 *
 * Una sola consulta per petició (`cache`), amb la clau de servei: /prova és
 * pública i la RLS de `profiles` no deixaria veure els altres perfils.
 */
export const getInactiveProfileIds = cache(async (): Promise<Set<string>> => {
  if (USE_MOCK) {
    return new Set(getStore().profiles.filter((p) => p.deactivated_at).map((p) => p.id));
  }
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .not("deactivated_at", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.id));
});
