/**
 * Límits del vídeo d'un exercici. Compartits client/servidor (sense
 * `server-only`): el formulari comprova el fitxer ABANS d'enviar-lo i el
 * servidor hi torna, i han de dir exactament el mateix.
 */

/**
 * Límit real d'un vídeo d'exercici.
 *
 * Mana la plataforma, no aquest fitxer: el vídeo viatja dins d'una Server
 * Action i Vercel talla el cos de la petició a ~4,5 MB, responent 413 abans
 * que Next hi digui res. Es queda a 3,5 MB per deixar marge al multipart
 * (noms de camp, límits, la resta del formulari), que també compta, i ha
 * d'anar per sota del `bodySizeLimit` de next.config.ts (4 MB).
 *
 * Per a vídeos grossos caldria pujar-los directament a Storage des del
 * navegador, sense passar per l'acció.
 */
export const MAX_VIDEO_MB = 3.5;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/quicktime"]);

/** Text del límit per a etiquetes i missatges. */
export const VIDEO_LIMIT_LABEL = `MP4 / MOV, màx. ${MAX_VIDEO_MB} MB`;

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
      error: `El vídeo és massa gran: ${(file.size / 1024 / 1024).toFixed(1)} MB. El límit és de ${MAX_VIDEO_MB} MB.`,
    };
  if (!ALLOWED_VIDEO_MIME.has(file.type))
    return { ok: false, error: "Format no acceptat. Usa MP4 o MOV." };
  return { ok: true };
}
