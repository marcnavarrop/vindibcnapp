import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "exercise-videos";
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime"]);
const SIGNED_URL_TTL = 3600; // 1 hora

export function validateExerciseVideo(
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

export async function uploadExerciseVideo(
  exerciseId: string,
  file: File,
): Promise<string> {
  const validation = validateExerciseVideo(file);
  if (!validation.ok) throw new Error(validation.error);

  const ext = file.name.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
  const storagePath = `${exerciseId}/${crypto.randomUUID()}.${ext}`;

  if (USE_MOCK) {
    // En mode mock, simulem la pujada retornant el path
    return storagePath;
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Error pujant el vídeo: ${error.message}`);
  return storagePath;
}

export async function getExerciseVideoSignedUrl(
  storagePath: string,
): Promise<string> {
  if (USE_MOCK) {
    return `data:text/plain;charset=utf-8,mock-exercise-video-${storagePath}`;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error || !data)
    throw new Error("No s'ha pogut generar l'URL del vídeo.");
  return data.signedUrl;
}

export async function deleteExerciseVideo(storagePath: string): Promise<void> {
  if (USE_MOCK) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([storagePath]);
}
