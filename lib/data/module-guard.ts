import "server-only";
import { notFound } from "next/navigation";
import { getCenterSettings } from "@/lib/data/center-settings";
import type { ModuleFlags } from "@/lib/nav";

/**
 * Talla el render si el mòdul està desactivat.
 *
 * Amagar l'entrada del menú no n'hi ha prou: la ruta continuaria sent
 * accessible escrivint l'URL. Es respon 404 (notFound) i no una redirecció,
 * perquè per a qui hi arriba el mòdul senzillament no existeix.
 *
 * S'ha de cridar al principi de cada pàgina d'un mòdul opcional. Els prefixos
 * de cada mòdul viuen a MODULE_PATHS (lib/nav.ts), que és el que fa servir
 * també el filtre del menú.
 */
export async function assertModuleEnabled(
  module: keyof ModuleFlags,
): Promise<void> {
  const { modules } = await getCenterSettings();
  if (!modules[module]) notFound();
}
