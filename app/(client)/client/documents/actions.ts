"use server";

import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import {
  deleteClientDocument,
  prepareDocumentPath,
  registerUploadedDocument,
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
  | "notUploaded"
  | "deleteFailed";

export type DocFormState = { errorCode?: DocErrorCode; ok?: boolean };

/**
 * Pas 1 de la pujada: on ha de pujar el navegador el fitxer.
 *
 * El fitxer no passa per aquí (Vercel el tallaria a 4,5 MB): el navegador el
 * puja directament a Storage amb la sessió del client, i la RLS de Storage
 * (0025) només el deixa escriure a la seva carpeta. Aquí es comprova qui és,
 * que té fitxa, la mida i el tipus declarats, i es dona el camí.
 */
export async function prepareDocumentUploadAction(file: {
  size: number;
  type: string;
}): Promise<{ ok: true; path: string } | { ok: false; errorCode: DocErrorCode }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errorCode: "unauthenticated" };
  const client = await getClientByProfile(viewer.id);
  if (!client) return { ok: false, errorCode: "noClient" };
  const r = prepareDocumentPath(client.id, { size: Number(file?.size ?? 0), type: String(file?.type ?? "") });
  return r.ok ? { ok: true, path: r.path } : { ok: false, errorCode: r.code };
}

/**
 * Pas 2: el fitxer ja és a Storage; es comprova de debò i es desa la fila.
 * `size` i `type` només els fa servir la simulació: a Supabase es llegeixen
 * del fitxer pujat, no del que digui el navegador.
 */
export async function registerDocumentAction(input: {
  path: string;
  fileName: string;
  description?: string;
  size?: number;
  type?: string;
}): Promise<DocFormState> {
  const viewer = await getViewer();
  if (!viewer) return { errorCode: "unauthenticated" };
  const client = await getClientByProfile(viewer.id);
  if (!client) return { errorCode: "noClient" };
  try {
    const r = await registerUploadedDocument({
      clientId: client.id,
      uploadedBy: viewer.id,
      path: String(input?.path ?? ""),
      fileName: String(input?.fileName ?? ""),
      description: String(input?.description ?? "").trim().slice(0, 200) || undefined,
      mockSize: Number(input?.size ?? 0),
      mockType: String(input?.type ?? ""),
    });
    if (r.ok) return { ok: true };
    if (r.code === "tooBig" || r.code === "badFormat") return { errorCode: r.code };
    if (r.code === "notFound") return { errorCode: "notUploaded" };
    if (r.code === "badPath") return { errorCode: "badId" };
    return { errorCode: "uploadFailed" };
  } catch {
    return { errorCode: "uploadFailed" };
  }
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
