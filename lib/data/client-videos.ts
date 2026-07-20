import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "client-videos";
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime"]);
const SIGNED_URL_TTL = 3600; // 1 hora

export type ClientVideo = {
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

function toClientVideo(r: {
  id: string;
  client_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_at: string;
}): ClientVideo {
  return {
    id: r.id,
    clientId: r.client_id,
    uploadedBy: r.uploaded_by,
    storagePath: r.storage_path,
    fileName: r.file_name,
    fileSize: r.file_size,
    mimeType: r.mime_type,
    description: r.description,
    uploadedAt: r.uploaded_at,
  };
}

export function validateVideoFile(
  file: File,
): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_SIZE)
    return {
      ok: false,
      error: `El vídeo supera el límit de 200 MB (${(file.size / 1024 / 1024).toFixed(0)} MB).`,
    };
  if (!ALLOWED_MIME.has(file.type))
    return { ok: false, error: "Format no acceptat. Usa MP4 o MOV." };
  return { ok: true };
}

export async function listClientVideos(clientId: string): Promise<ClientVideo[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return (getStore().client_videos ?? [])
      .filter((v) => v.client_id === clientId)
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
      .map(toClientVideo);
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_videos")
    .select("*")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toClientVideo);
}

export async function uploadClientVideo(opts: {
  clientId: string;
  uploadedBy: string;
  file: File;
  description?: string;
}): Promise<ClientVideo> {
  const { clientId, uploadedBy, file, description } = opts;

  const validation = validateVideoFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const ext = file.name.endsWith(".mov") ? "mov" : "mp4";
  const uuid = crypto.randomUUID();
  const storagePath = `${clientId}/${uuid}.${ext}`;

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    if (!store.client_videos) store.client_videos = [];
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
    store.client_videos.push(row);
    saveStore(store);
    return toClientVideo(row);
  }

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) throw new Error(`Error pujant el vídeo: ${uploadError.message}`);

  const { data, error: dbError } = await admin
    .from("client_videos")
    .insert({
      client_id: clientId,
      uploaded_by: uploadedBy,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      description: description ?? null,
    })
    .select("*")
    .single();

  if (dbError || !data) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error(dbError?.message ?? "Error desant el vídeo.");
  }
  return toClientVideo(data);
}

export async function getVideoSignedUrl(videoId: string): Promise<string> {
  if (USE_MOCK) {
    return `data:text/plain;charset=utf-8,mock-video-${videoId}`;
  }
  const admin = createAdminClient();
  const { data: row, error: dbErr } = await admin
    .from("client_videos")
    .select("storage_path, file_name")
    .eq("id", videoId)
    .single();
  if (dbErr || !row) throw new Error("Vídeo no trobat.");

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL, {
      download: row.file_name,
    });
  if (error || !data) throw new Error("No s'ha pogut generar l'URL del vídeo.");
  return data.signedUrl;
}

export async function deleteClientVideo(videoId: string): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    store.client_videos = (store.client_videos ?? []).filter((v) => v.id !== videoId);
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("client_videos")
    .select("storage_path")
    .eq("id", videoId)
    .single();
  if (row) await admin.storage.from(BUCKET).remove([row.storage_path]);
  await admin.from("client_videos").delete().eq("id", videoId);
}

export async function deleteAllClientVideos(clientId: string): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    store.client_videos = (store.client_videos ?? []).filter(
      (v) => v.client_id !== clientId,
    );
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("client_videos")
    .select("storage_path")
    .eq("client_id", clientId);
  if (rows && rows.length > 0) {
    await admin.storage
      .from(BUCKET)
      .remove(rows.map((r) => r.storage_path));
  }
  await admin.from("client_videos").delete().eq("client_id", clientId);
}
