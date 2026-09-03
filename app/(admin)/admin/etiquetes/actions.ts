"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createClientTag,
  renameClientTag,
  deleteClientTag,
  assignTag,
  unassignTag,
} from "@/lib/data/client-tags";

/**
 * Accions de les etiquetes de client.
 *
 * El permís de veritat el posa la RLS de la 0068 —el catàleg només l'escriu
 * l'admin; les assignacions, l'admin i l'entrenador/a assignat— i aquestes
 * funcions escriuen amb el client de la SESSIÓ, així que la policy s'avalua.
 * Els `getViewer()` d'aquí no són el pany: són per saber qui assigna.
 */

export type TagFormState = { error?: string };

// ─── Catàleg (/admin/etiquetes) ─────────────────────────────────────────────

export async function createTagAction(
  _prev: TagFormState,
  fd: FormData,
): Promise<TagFormState> {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "El nom és obligatori." };
  try {
    await createClientTag(name);
  } catch (err) {
    console.error("[createTagAction]", err);
    return { error: err instanceof Error ? err.message : "No s'ha pogut crear." };
  }
  revalidatePath("/admin/etiquetes");
  return {};
}

export async function renameTagAction(
  _prev: TagFormState,
  fd: FormData,
): Promise<TagFormState> {
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  if (!id || !name) return { error: "Falten dades." };
  try {
    await renameClientTag(id, name);
  } catch (err) {
    console.error("[renameTagAction]", err);
    return { error: err instanceof Error ? err.message : "No s'ha pogut reanomenar." };
  }
  revalidatePath("/admin/etiquetes");
  revalidatePath("/admin/clients");
  return {};
}

export async function deleteTagAction(
  _prev: TagFormState,
  fd: FormData,
): Promise<TagFormState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Falta l'etiqueta." };
  try {
    await deleteClientTag(id);
  } catch (err) {
    console.error("[deleteTagAction]", err);
    return { error: err instanceof Error ? err.message : "No s'ha pogut esborrar." };
  }
  revalidatePath("/admin/etiquetes");
  revalidatePath("/admin/clients");
  return {};
}

// ─── Assignació des de la fitxa d'un client ─────────────────────────────────

/**
 * Marca o desmarca una etiqueta d'un client.
 *
 * `redirectPath` arriba des de la pantalla que la crida perquè la fitxa existeix
 * dues vegades —/admin/clients/[id] i /trainer/clients/[id]— i cadascuna s'ha de
 * revalidar la seva. També es revalida /client/bonos: si l'etiqueta obre una
 * oferta, el preu que veu aquest client acaba de canviar.
 */
export async function toggleClientTagAction(
  clientId: string,
  redirectPath: string,
  fd: FormData,
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  const tagId = String(fd.get("tagId") ?? "");
  const checked = fd.get("checked") === "true";
  if (!tagId) return;

  if (checked) await assignTag({ clientId, tagId, assignedBy: viewer.id });
  else await unassignTag(clientId, tagId);

  revalidatePath(redirectPath);
  revalidatePath("/client/bonos");
}

/**
 * Crea una etiqueta i l'assigna d'una tacada, des de la fitxa del client.
 *
 * Només l'admin: crear catàleg és seu (RLS de la 0068). Un entrenador/a que ho
 * intenti rebrà l'error de la policy, i el formulari només se li ensenya a
 * l'admin.
 */
export async function createAndAssignTagAction(
  clientId: string,
  redirectPath: string,
  fd: FormData,
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;

  // `createClientTag` torna la que ja hi hagi si el nom es repeteix: escriure
  // "vip" aquí assigna la VIP existent en comptes de crear-ne una segona.
  const tagId = await createClientTag(name);
  await assignTag({ clientId, tagId, assignedBy: viewer.id });

  revalidatePath(redirectPath);
  revalidatePath("/admin/etiquetes");
  revalidatePath("/client/bonos");
}
