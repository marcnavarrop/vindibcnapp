/**
 * Límits del vídeo d'un exercici. Compartits client/servidor (sense
 * `server-only`): el formulari comprova el fitxer ABANS de pujar-lo, el servidor
 * ho torna a comprovar en donar el permís i en desar l'exercici, i han de dir
 * exactament el mateix.
 */

/**
 * Límit d'un vídeo d'exercici. ÉS L'ÚNIC LLOC ON ES FIXA.
 *
 * El vídeo ja no passa per Vercel (que talla qualsevol petició a 4,5 MB): el
 * navegador el puja directament a Supabase Storage amb un permís de pujada
 * signat (vegeu `lib/data/exercise-videos.ts`). El que mana ara és Supabase:
 * - pla Free: 50 MB per fitxer a tot el projecte, i no es pot pujar;
 * - pla Pro: fins a 500 GB, configurable al tauler (Storage → Settings).
 * El bucket `exercise-videos` (migració 0028) admet 200 MB.
 *
 * Per pujar-lo amb el pla Pro: canviar aquest número, i que el límit global de
 * Supabase i el del bucket siguin com a mínim això.
 */
export const MAX_VIDEO_MB = 50;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/quicktime"]);

/** Text del límit per a etiquetes i missatges. */
export const VIDEO_LIMIT_LABEL = `MP4 / MOV, màx. ${MAX_VIDEO_MB} MB`;

/** Consell de gravació, sota el camp del fitxer. */
export const VIDEO_RECORDING_TIP =
  "Grava en 1080p i menys de 30 s: un vídeo així ocupa uns 20-30 MB. En 4K o més llarg passarà del límit.";

/**
 * Carpeta on cauen els vídeos acabats de pujar, abans que l'exercici es desi.
 * En desar-lo, el vídeo es mou a la carpeta de l'exercici; el que es queda
 * aquí més d'un dia és d'una pujada abandonada i el cron l'esborra.
 */
export const PENDING_VIDEO_DIR = "pending";

/** Un camí de `pending/` com els que dona el servidor (uuid + extensió). */
export function isPendingVideoPath(path: string): boolean {
  return /^pending\/[0-9a-f-]{36}\.(mp4|mov)$/.test(path);
}

/** El tipus d'un fitxer de vídeo. Safari i alguns Android el donen buit per als .mov. */
export function videoMimeOf(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  return file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : file.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "";
}

/**
 * Comprovació d'un vídeo. La fan els dos costats: el client per avisar sense
 * esperar el viatge, el servidor perquè és qui mana.
 */
export function checkExerciseVideo(file: {
  size: number;
  type: string;
}): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_VIDEO_BYTES)
    return {
      ok: false,
      error: `El vídeo és massa gran: ${(file.size / 1024 / 1024).toFixed(1)} MB. El límit és de ${MAX_VIDEO_MB} MB. Grava'l en 1080p i més curt, o posa un enllaç de YouTube.`,
    };
  if (!ALLOWED_VIDEO_MIME.has(file.type))
    return { ok: false, error: "Format no acceptat. Usa MP4 o MOV." };
  return { ok: true };
}
