"use server";

import { revalidatePath } from "next/cache";
import { createCenter, renameCenter } from "@/lib/data/centers";

/**
 * Accions del registre de noms de centres (Configuració → Registre de centres).
 *
 * VIU AQUÍ I NO A `app/(admin)/admin/configuracio/` A POSTA
 *
 * En aquella carpeta ja hi ha `center-actions.ts`, que és el dels AJUSTOS del
 * centre —`center_settings`, el singleton d'horaris i política de
 * cancel·lació—. Un `centers-actions.ts` al costat s'hi hauria diferenciat per
 * una lletra, i són dues coses que no tenen res a veure: exactament la
 * confusió contra la qual avisa la capçalera de la 0080. `lib/actions/` ja és
 * un lloc de la casa per a això (exercise-actions, locale-actions, support) i
 * aquí no xoca amb res.
 *
 * El permís el posa la RLS de la 0080 —només l'admin llegeix i escriu— i la
 * capa de dades escriu amb el client de la SESSIÓ, així que la policy
 * s'avalua. Aquí no es comprova el rol perquè seria una segona font de veritat
 * que pot divergir de la primera.
 *
 * No hi ha acció d'esborrar: la 0080 tampoc en té policy.
 */
export type CenterFormState = { error?: string; ok?: boolean };

export async function createCenterAction(
  _prev: CenterFormState,
  fd: FormData,
): Promise<CenterFormState> {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "El nom és obligatori." };
  try {
    await createCenter(name);
  } catch (err) {
    console.error("[createCenterAction]", err);
    return { error: err instanceof Error ? err.message : "No s'ha pogut crear." };
  }
  revalidatePath("/admin/configuracio");
  return { ok: true };
}

export async function renameCenterAction(
  _prev: CenterFormState,
  fd: FormData,
): Promise<CenterFormState> {
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  if (!id || !name) return { error: "Falten dades." };
  try {
    await renameCenter(id, name);
  } catch (err) {
    console.error("[renameCenterAction]", err);
    return { error: err instanceof Error ? err.message : "No s'ha pogut reanomenar." };
  }
  revalidatePath("/admin/configuracio");
  return { ok: true };
}
