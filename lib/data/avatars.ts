import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fotos de perfil al Storage.
 *
 * Bucket PRIVAT, com la resta: la foto es serveix amb una signed URL generada
 * al servidor. Les pantalles reben una URL ja signada i no saben res del
 * bucket ni de la ruta.
 */
const BUCKET = "profile-avatars";

/** Vida de la signed URL. Una hora: les pàgines es renderitzen per petició. */
const SIGNED_URL_TTL = 3600;

const MAX_SIZE = 3 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAvatarFile(
  file: File,
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED.has(file.type))
    return { ok: false, error: "La foto ha de ser JPG, PNG o WEBP." };
  if (file.size > MAX_SIZE)
    return {
      ok: false,
      error: `La foto supera el límit de 3 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    };
  return { ok: true };
}

/**
 * Puja la foto d'un perfil i torna la ruta desada.
 *
 * Cada pujada estrena nom (uuid) en comptes de sobreescriure: així una foto
 * nova no queda tapada per la versió antiga a la memòria cau del navegador ni
 * a la CDN. L'anterior l'esborra qui crida, un cop desada la ruta nova.
 */
export async function uploadAvatar(
  profileId: string,
  file: File,
): Promise<string> {
  const check = validateAvatarFile(file);
  if (!check.ok) throw new Error(check.error);

  const path = `${profileId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  if (USE_MOCK) return path;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`No s'ha pogut pujar la foto: ${error.message}`);
  return path;
}

/** Esborra una foto del bucket. Silenciós: no és crític si ja no hi és. */
export async function deleteAvatar(path: string | null): Promise<void> {
  if (!path || USE_MOCK) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([path]);
}

/**
 * Signed URLs per a diverses rutes d'un cop.
 *
 * En lot i no una a una perquè les pantalles que en necessiten (el llistat
 * d'entrenadors, la llegenda del calendari) les demanen totes alhora: fer-ho
 * per separat serien N viatges de xarxa per pintar una llista.
 */
export async function avatarUrls(
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  if (wanted.length === 0 || USE_MOCK) return out;

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(wanted, SIGNED_URL_TTL);
  for (const row of data ?? [])
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  return out;
}

/** Signed URL d'una sola foto (o null si no en té). */
export async function avatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return (await avatarUrls([path])).get(path) ?? null;
}
