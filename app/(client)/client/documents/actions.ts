"use server";

import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import {
  uploadClientDocument,
  deleteClientDocument,
  getDocumentSignedUrl,
  validateDocumentFile,
} from "@/lib/data/client-documents";
import { redirect } from "next/navigation";

export type DocFormState = { error?: string; ok?: boolean };

export async function uploadDocumentAction(
  _prev: DocFormState,
  formData: FormData,
): Promise<DocFormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "No autenticat." };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { error: "No tens fitxa de client." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Selecciona un fitxer." };

  const validation = validateDocumentFile(file);
  if (!validation.ok) return { error: validation.error };

  const description = (formData.get("description") as string | null)?.trim() || undefined;

  try {
    await uploadClientDocument({
      clientId: client.id,
      uploadedBy: viewer.id,
      file,
      description,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en pujar el fitxer." };
  }

  return { ok: true };
}

export async function deleteDocumentAction(
  _prev: DocFormState,
  formData: FormData,
): Promise<DocFormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "No autenticat." };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { error: "No tens fitxa de client." };

  const documentId = formData.get("documentId") as string | null;
  if (!documentId) return { error: "ID de document invàlid." };

  try {
    await deleteClientDocument(documentId, client.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en eliminar el document." };
  }

  return { ok: true };
}

export async function downloadDocumentAction(
  formData: FormData,
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const client = await getClientByProfile(viewer.id);
  if (!client) redirect("/client");

  const documentId = formData.get("documentId") as string | null;
  if (!documentId) redirect("/client/documents");

  const url = await getDocumentSignedUrl(documentId, client.id);
  redirect(url);
}
