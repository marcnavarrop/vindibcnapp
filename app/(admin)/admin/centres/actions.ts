"use server";

import { revalidatePath } from "next/cache";
import { createCenter, renameCenter } from "@/lib/data/centers";

/**
 * Accions del registre de centres (/admin/centres).
 *
 * El permís de veritat el posa la RLS de la 0080 —només l'admin llegeix i
 * escriu— i la capa de dades escriu amb el client de la SESSIÓ, així que la
 * policy s'avalua de debò. Aquí no hi ha cap comprovació de rol perquè seria
 * una segona font de veritat que pot divergir de la primera.
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
  revalidatePath("/admin/centres");
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
  revalidatePath("/admin/centres");
  return { ok: true };
}
