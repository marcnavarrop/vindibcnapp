import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkExerciseVideo } from "@/lib/exercise-video.constants";

const BUCKET = "exercise-videos";
const SIGNED_URL_TTL = 3600; // 1 hora

/** Reexportat perquè qui ja l'importava d'aquí no s'hagi d'assabentar. */
export { MAX_VIDEO_MB } from "@/lib/exercise-video.constants";

export function validateExerciseVideo(
  file: File,
): { ok: true } | { ok: false; error: string } {
  return checkExerciseVideo(file);
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
