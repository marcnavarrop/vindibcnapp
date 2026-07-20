import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "client-documents";
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
/** Durada de les signed URLs (1 hora). */
const SIGNED_URL_TTL = 3600;

export type ClientDocument = {
  id: string;
  clientId: string;
  uploadedBy: string;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
  uploadedAt: string;
};

export function validateDocumentFile(
  file: File,
): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_SIZE)
    return { ok: false, error: `El fitxer supera el límit de 15 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  if (!ALLOWED_MIME.has(file.type))
    return { ok: false, error: "Format no acceptat. Usa PDF, imatge (JPG/PNG/HEIC) o Word." };
  return { ok: true };
}

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

export async function uploadClientDocument(opts: {
  clientId: string;
  uploadedBy: string;
  file: File;
  description?: string;
}): Promise<ClientDocument> {
  const { clientId, uploadedBy, file, description } = opts;

  const validation = validateDocumentFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const ext = file.name.split(".").pop() ?? "bin";
  const uuid = crypto.randomUUID();
  const storagePath = `${clientId}/${uuid}.${ext}`;

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const row = {
      id: uuid,
      client_id: clientId,
      uploaded_by: uploadedBy,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      description: description ?? null,
      uploaded_at: new Date().toISOString(),
    };
    store.client_documents.push(row);
    saveStore(store);
    return toClientDocument(row);
  }

  // Upload al bucket (usem el client de sessió — RLS Storage valida ownership).
  const supabase = await createClient();
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (storageError) throw new Error(storageError.message);

  // Guarda metadades.
  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      client_id: clientId,
      uploaded_by: uploadedBy,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      description: description || null,
    })
    .select()
    .single();
  if (error) {
    // Si falla la inserció, intenta netejar el fitxer pujat.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  return toClientDocument(data);
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
  uploaded_by: string;
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
