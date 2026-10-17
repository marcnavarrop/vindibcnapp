import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkDocument,
  documentExtOf,
  isDocumentPathOf,
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_MAX_BYTES,
  type DocumentRejection,
} from "@/lib/documents";

const BUCKET = "client-documents";
/** Durada de les signed URLs (1 hora). */
const SIGNED_URL_TTL = 3600;

export type ClientDocument = {
  id: string;
  clientId: string;
  /** Null si el perfil de qui el va pujar s'ha esborrat (0116). */
  uploadedBy: string | null;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
  uploadedAt: string;
};

export type { DocumentRejection };

// ─── LIST ────────────────────────────────────────────────────────────────────

export async function listClientDocuments(
  clientId: string,
): Promise<ClientDocument[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return store.client_documents
      .filter((d) => d.client_id === clientId)
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
      .map(toClientDocument);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_documents")
    .select("*")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toClientDocument);
}

// ─── UPLOAD ──────────────────────────────────────────────────────────────────
//
// El fitxer NO passa per Vercel (que talla les peticions a 4,5 MB, i el límit
// dels documents és de 15). El navegador el puja directament a Storage AMB LA
// SESSIÓ DEL CLIENT, de manera que la barrera continua sent la RLS de la 0025:
// `storage_client_documents_insert` només el deixa escriure a la seva carpeta
// `{client_id}/`. Aquí no s'usa la clau de servei per pujar: són documents que
// poden ser de salut, i la frontera ha de ser la base, no l'aplicació.
//
// 1. `prepareDocumentPath`: el camí nou dins la carpeta del client.
// 2. El navegador hi puja el fitxer (POST a Storage, amb barra de progrés).
// 3. `registerUploadedDocument`: comprova el fitxer DE DEBÒ (mida i tipus segons
//    Storage) i desa la fila, també amb la sessió (RLS `client_documents_insert`).
// 4. El que es queda a Storage sense fila (pujada a mitges, pestanya tancada)
//    ho esborra el cron l'endemà: `cleanupOrphanDocuments`.

export function prepareDocumentPath(
  clientId: string,
  file: { size: number; type: string },
): { ok: true; path: string } | { ok: false; code: DocumentRejection } {
  const check = checkDocument(file);
  if (!check.ok) return check;
  return { ok: true, path: `${clientId}/${crypto.randomUUID()}.${documentExtOf(file.type)}` };
}

export type RegisterResult =
  | { ok: true; document: ClientDocument }
  | { ok: false; code: DocumentRejection | "notFound" | "badPath" | "failed" };

export async function registerUploadedDocument(opts: {
  clientId: string;
  uploadedBy: string;
  path: string;
  fileName: string;
  description?: string;
  /** Només en simulació, on no hi ha Storage d'on llegir-los. */
  mockSize?: number;
  mockType?: string;
}): Promise<RegisterResult> {
  const { clientId, uploadedBy, path, description } = opts;
  if (!isDocumentPathOf(clientId, path)) return { ok: false, code: "badPath" };
  const fileName = opts.fileName.trim().slice(0, 200) || path.split("/")[1];

  if (USE_MOCK) {
    const check = checkDocument({ size: opts.mockSize ?? 0, type: opts.mockType ?? "" });
    if (!check.ok) return check;
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const row = {
      id: crypto.randomUUID(),
      client_id: clientId,
      uploaded_by: uploadedBy,
      storage_path: path,
      file_name: fileName,
      file_size: opts.mockSize ?? null,
      mime_type: opts.mockType ?? null,
      description: description ?? null,
      uploaded_at: new Date().toISOString(),
    };
    store.client_documents.push(row);
    saveStore(store);
    return { ok: true, document: toClientDocument(row) };
  }

  // Amb la sessió del client: si no és seu, la RLS de Storage ni el deixa veure.
  const supabase = await createClient();
  const [folder, name] = path.split("/");
  const { data: found } = await supabase.storage.from(BUCKET).list(folder, { search: name, limit: 1 });
  const obj = found?.find((o) => o.name === name);
  if (!obj) return { ok: false, code: "notFound" };

  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  const size = Number(meta.size ?? 0);
  const mime = String(meta.mimetype ?? "");
  if (size > DOCUMENT_MAX_BYTES || !DOCUMENT_ALLOWED_MIME.has(mime)) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, code: size > DOCUMENT_MAX_BYTES ? "tooBig" : "badFormat" };
  }

  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      client_id: clientId,
      uploaded_by: uploadedBy,
      storage_path: path,
      file_name: fileName,
      file_size: size,
      mime_type: mime,
      description: description || null,
    })
    .select()
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, code: "failed" };
  }
  return { ok: true, document: toClientDocument(data) };
}

/** A partir de quan un fitxer sense fila es considera una pujada abandonada. */
export const ORPHAN_DOCUMENT_MAX_AGE_HOURS = 24;

/**
 * Esborra els fitxers de `client-documents` que no tenen fila a
 * `client_documents` i fa més d'un dia que hi són (pujades a mitges). Torna
 * quants n'ha esborrat. Clau de servei: és manteniment del cron, sense sessió.
 */
export async function cleanupOrphanDocuments(): Promise<number> {
  if (USE_MOCK) return 0;
  const admin = createAdminClient();
  const cutoff = Date.now() - ORPHAN_DOCUMENT_MAX_AGE_HOURS * 3600 * 1000;
  const { data: folders, error } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
  if (error || !folders) {
    console.error("[documents] no s'han pogut llistar les carpetes", error?.message);
    return 0;
  }
  let removed = 0;
  // Les carpetes són els clients (`{client_id}/`); els fitxers solts de
  // l'arrel, si n'hi hagués, no són d'aquest flux i no es toquen.
  for (const folder of folders.filter((f) => f.id === null)) {
    const { data: files } = await admin.storage.from(BUCKET).list(folder.name, { limit: 1000 });
    const old = (files ?? []).filter((f) => f.id && f.created_at && new Date(f.created_at).getTime() < cutoff);
    if (!old.length) continue;
    const { data: rows, error: rowsError } = await admin
      .from("client_documents")
      .select("storage_path")
      .eq("client_id", folder.name)
      .limit(1000);
    if (rowsError) continue; // dubte → no s'esborra res
    const known = new Set((rows ?? []).map((r) => r.storage_path));
    const orphans = old.map((f) => `${folder.name}/${f.name}`).filter((p) => !known.has(p));
    if (!orphans.length) continue;
    const { error: rmError } = await admin.storage.from(BUCKET).remove(orphans);
    if (rmError) console.error("[documents] no s'han pogut esborrar orfes", rmError.message);
    else removed += orphans.length;
  }
  return removed;
}

// ─── SIGNED URL ──────────────────────────────────────────────────────────────

export async function getDocumentSignedUrl(
  documentId: string,
  clientId: string,
): Promise<string> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const doc = store.client_documents.find(
      (d) => d.id === documentId && d.client_id === clientId,
    );
    if (!doc) throw new Error("Document no trobat.");
    // En mode mock retornem una URL simulada.
    return `data:text/plain;charset=utf-8,${encodeURIComponent("[Document mock: " + doc.file_name + "]")}`;
  }

  const supabase = await createClient();
  const { data: doc, error: docError } = await supabase
    .from("client_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("client_id", clientId)
    .single();
  if (docError || !doc) throw new Error("Document no trobat.");

  // Fem servir el client d'admin per generar la signed URL des del servidor.
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw new Error("No s'ha pogut generar l'enllaç de descàrrega.");
  return data.signedUrl;
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteClientDocument(
  documentId: string,
  clientId: string,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    store.client_documents = store.client_documents.filter(
      (d) => !(d.id === documentId && d.client_id === clientId),
    );
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { data: doc, error: docError } = await supabase
    .from("client_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("client_id", clientId)
    .single();
  if (docError || !doc) throw new Error("Document no trobat.");

  // Esborra el fitxer del Storage.
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([doc.storage_path]);

  // Esborra la fila de metadades.
  const { error } = await supabase
    .from("client_documents")
    .delete()
    .eq("id", documentId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

// ─── GDPR: esborra tots els documents d'un client (Storage + taula) ──────────

export async function deleteAllClientDocuments(clientId: string): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    store.client_documents = store.client_documents.filter(
      (d) => d.client_id !== clientId,
    );
    saveStore(store);
    return;
  }

  const admin = createAdminClient();

  // Obté totes les rutes de fitxers.
  const { data: docs } = await admin
    .from("client_documents")
    .select("storage_path")
    .eq("client_id", clientId);

  if (docs && docs.length > 0) {
    const paths = docs.map((d) => d.storage_path);
    await admin.storage.from(BUCKET).remove(paths);
  }

  // Les files de la taula es netegen per CASCADE quan s'elimina el client,
  // però les esborrem explícitament aquí per si s'executa abans del delete.
  await admin.from("client_documents").delete().eq("client_id", clientId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toClientDocument(row: {
  id: string;
  client_id: string;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_at: string;
}): ClientDocument {
  return {
    id: row.id,
    clientId: row.client_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    description: row.description,
    uploadedAt: row.uploaded_at,
  };
}
