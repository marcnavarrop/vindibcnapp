import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_VIDEO_MIME,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  PENDING_VIDEO_DIR,
  checkExerciseVideo,
  isPendingVideoPath,
} from "@/lib/exercise-video.constants";

/**
 * Vídeos dels exercicis, al bucket privat `exercise-videos` (migració 0028).
 *
 * ─── COM ES PUJA UN VÍDEO ───
 *
 * El fitxer NO passa per Vercel: qualsevol petició a una funció de Vercel es
 * talla a 4,5 MB, i un vídeo de mòbil en fa desenes. El camí és:
 *
 * 1. `createPendingVideoUpload` (des d'una acció que ja ha mirat que qui ho
 *    demana és professional o admin): comprova la mida i el tipus declarats i
 *    dona un permís de pujada SIGNAT per a un camí nou de `pending/`. El permís
 *    és d'un sol camí, sense sobreescriure (`upsert: false`), i Supabase el fa
 *    caducar a les 2 hores.
 * 2. El navegador hi puja el fitxer directament (amb barra de progrés).
 * 3. En desar l'exercici, `finalizePendingVideo` comprova el fitxer DE DEBÒ
 *    (la mida i el tipus que té a Storage, no els que va dir el navegador) i el
 *    mou a la carpeta de l'exercici.
 * 4. El que es queda a `pending/` més d'un dia és una pujada abandonada:
 *    `cleanupPendingExerciseVideos`, des del cron diari, l'esborra.
 */

const BUCKET = "exercise-videos";
const SIGNED_URL_TTL = 3600; // 1 hora
/** Una pujada sense exercici desat, a partir de quan es considera abandonada. */
export const PENDING_MAX_AGE_HOURS = 24;

export type PendingUpload = {
  /** Camí dins del bucket (`pending/<uuid>.<ext>`). */
  path: string;
  /** On fer el PUT del fitxer. `null` en simulació: no hi ha Storage. */
  signedUrl: string | null;
};

export async function createPendingVideoUpload(file: {
  name: string;
  size: number;
  type: string;
}): Promise<PendingUpload> {
  const check = checkExerciseVideo(file);
  if (!check.ok) throw new Error(check.error);

  const ext = file.type === "video/quicktime" ? "mov" : "mp4";
  const path = `${PENDING_VIDEO_DIR}/${crypto.randomUUID()}.${ext}`;
  if (USE_MOCK) return { path, signedUrl: null };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data)
    throw new Error("No s'ha pogut preparar la pujada del vídeo. Torna-ho a provar.");
  return { path, signedUrl: data.signedUrl };
}

/**
 * El vídeo pujat a `pending/`, comprovat i mogut a la carpeta de l'exercici.
 * Torna el camí definitiu. Si el fitxer no hi és o no compleix, l'esborra i
 * llança un error amb el motiu.
 */
export async function finalizePendingVideo(
  exerciseId: string,
  pendingPath: string,
): Promise<string> {
  if (!isPendingVideoPath(pendingPath)) throw new Error("El vídeo pujat no és vàlid.");
  const fileName = pendingPath.slice(PENDING_VIDEO_DIR.length + 1);
  const finalPath = `${exerciseId}/${fileName}`;
  if (USE_MOCK) return finalPath;

  const admin = createAdminClient();
  const { data: found, error: listError } = await admin.storage
    .from(BUCKET)
    .list(PENDING_VIDEO_DIR, { search: fileName, limit: 1 });
  const obj = found?.find((o) => o.name === fileName);
  if (listError || !obj)
    throw new Error("No trobem el vídeo pujat. Torna'l a triar i espera que la barra arribi al final.");

  // El que diu Storage, no el navegador: el permís es va donar amb la mida
  // declarada, i aquí es comprova la que ha arribat de debò.
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  const size = Number(meta.size ?? 0);
  const mime = String(meta.mimetype ?? "");
  if (size > MAX_VIDEO_BYTES || !ALLOWED_VIDEO_MIME.has(mime)) {
    await admin.storage.from(BUCKET).remove([pendingPath]);
    throw new Error(
      size > MAX_VIDEO_BYTES
        ? `El vídeo és massa gran (${(size / 1024 / 1024).toFixed(1)} MB). El límit és de ${MAX_VIDEO_MB} MB.`
        : "Format no acceptat. Usa MP4 o MOV.",
    );
  }

  const { error: moveError } = await admin.storage.from(BUCKET).move(pendingPath, finalPath);
  if (moveError) throw new Error("No s'ha pogut desar el vídeo. Torna-ho a provar.");
  return finalPath;
}

/**
 * Esborra les pujades abandonades: vídeos de `pending/` de fa més de
 * `PENDING_MAX_AGE_HOURS` (algú el va triar i no va desar l'exercici, o va
 * canviar de vídeo abans de desar). Torna quants n'ha esborrat.
 */
export async function cleanupPendingExerciseVideos(): Promise<number> {
  if (USE_MOCK) return 0;
  const admin = createAdminClient();
  const cutoff = Date.now() - PENDING_MAX_AGE_HOURS * 3600 * 1000;
  const { data, error } = await admin.storage
    .from(BUCKET)
    .list(PENDING_VIDEO_DIR, { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) {
    console.error("[videos] no s'han pogut llistar les pujades pendents", error?.message);
    return 0;
  }
  const old = data
    .filter((o) => o.created_at && new Date(o.created_at).getTime() < cutoff)
    .map((o) => `${PENDING_VIDEO_DIR}/${o.name}`);
  if (!old.length) return 0;
  const { error: rmError } = await admin.storage.from(BUCKET).remove(old);
  if (rmError) {
    console.error("[videos] no s'han pogut esborrar les pujades abandonades", rmError.message);
    return 0;
  }
  return old.length;
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
