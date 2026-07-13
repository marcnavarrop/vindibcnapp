"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import { deleteClient } from "@/lib/data/gdpr-delete";
import { logDataAccess } from "@/lib/data/data-access-log";

export type FormState = { error?: string };

/**
 * Supressió d'un client (dret a l'oblit). Doble confirmació: cal escriure el
 * nom exacte del client. Registra l'acció a data_access_log.
 */
export async function deleteClientAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const client = await getClient(clientId);
  if (!client) return { error: "Client no trobat." };

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed.toLowerCase() !== client.fullName.trim().toLowerCase())
    return { error: "El nom introduït no coincideix amb el del client." };

  let result;
  try {
    result = await deleteClient(clientId);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut eliminar el client.",
    };
  }
  if (!result) return { error: "Client no trobat." };

  try {
    await logDataAccess({
      actorId: viewer.id,
      subjectProfileId: result.profileId,
      subjectLabel: result.label,
      action: "delete",
      details: `Supressió des de la fitxa (client ${clientId}).`,
    });
  } catch {
    // El registre és best-effort; no revertim la supressió si el log falla.
  }

  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}
