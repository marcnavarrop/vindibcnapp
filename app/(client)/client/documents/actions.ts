"use server";

import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import {
  uploadClientDocument,
  deleteClientDocument,
  validateDocumentFile,
} from "@/lib/data/client-documents";

/** Codi, no frase: la pantalla de documents es veu en tres idiomes. */
export type DocErrorCode =
  | "unauthenticated"
  | "noClient"
  | "noFile"
  | "tooBig"
  | "badFormat"
  | "badId"
  | "uploadFailed"
  | "deleteFailed";

export type DocFormState = { errorCode?: DocErrorCode; ok?: boolean };

export async function uploadDocumentAction(
  _prev: DocFormState,
  formData: FormData,
): Promise<DocFormState> {
  const viewer = await getViewer();
  if (!viewer) return { errorCode: "unauthenticated" };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { errorCode: "noClient" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { errorCode: "noFile" };

  const validation = validateDocumentFile(file);
  if (!validation.ok) return { errorCode: validation.code };

  const description = (formData.get("description") as string | null)?.trim() || undefined;

  try {
    await uploadClientDocument({
      clientId: client.id,
      uploadedBy: viewer.id,
      file,
      description,
    });
  } catch {
    return { errorCode: "uploadFailed" };
  }

  return { ok: true };
}

export async function deleteDocumentAction(
  _prev: DocFormState,
  formData: FormData,
): Promise<DocFormState> {
  const viewer = await getViewer();
  if (!viewer) return { errorCode: "unauthenticated" };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { errorCode: "noClient" };

  const documentId = formData.get("documentId") as string | null;
  if (!documentId) return { errorCode: "badId" };

  try {
    await deleteClientDocument(documentId, client.id);
  } catch {
    return { errorCode: "deleteFailed" };
  }

  return { ok: true };
}
