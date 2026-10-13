/**
 * El límit de mida d'un document del client.
 *
 * Viu aquí, en un mòdul sense `"use client"` ni `server-only`, perquè el
 * número el necessiten TRES llocs que no poden compartir cap altre fitxer: el
 * formulari de pujada (client), la validació de l'acció (servidor) i el manual
 * d'ajuda (servidor). El tenien escrit cadascú pel seu compte.
 *
 * El primer intent va ser exportar-lo del formulari i importar-lo des del
 * manual, i no funciona: Next substitueix les exportacions d'un mòdul de client
 * per una referència, i al servidor no hi arribava el 15 sinó un proxy que
 * s'imprimia com un error enmig del text. Un mòdul neutre és l'única manera que
 * les dues bandes en llegeixin el mateix valor.
 */
export const DOCUMENT_MAX_MB = 15;

export const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;

/** Tipus que accepta el bucket `client-documents` (migració 0025). */
export const DOCUMENT_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Extensions per al selector de fitxers. */
export const DOCUMENT_ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "heic", "heif", "doc", "docx"];

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * El tipus d'un fitxer. Alguns navegadors el donen buit (HEIC a Chrome i
 * Firefox, Word a alguns Android): llavors es dedueix de l'extensió. El
 * bucket el torna a comprovar en rebre'l.
 */
export function documentMimeOf(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  return MIME_BY_EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

/** Extensió que es posa al camí de Storage (mai la que digui el nom original). */
export function documentExtOf(mime: string): string {
  return Object.entries(MIME_BY_EXT).find(([, m]) => m === mime)?.[0] ?? "bin";
}

/**
 * Un camí de document vàlid PER A AQUEST client: `{clientId}/{uuid}.{ext}`.
 * Qui registra un document només pot apuntar a la seva carpeta (la RLS de
 * Storage tampoc el deixaria pujar enlloc més).
 */
export function isDocumentPathOf(clientId: string, path: string): boolean {
  const esc = clientId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}/[0-9a-f-]{36}\\.(pdf|jpg|jpeg|png|heic|heif|doc|docx)$`).test(path);
}

export type DocumentRejection = "tooBig" | "badFormat";

/** La mateixa comprovació al navegador i al servidor. */
export function checkDocument(file: { size: number; type: string }): { ok: true } | { ok: false; code: DocumentRejection } {
  if (file.size > DOCUMENT_MAX_BYTES) return { ok: false, code: "tooBig" };
  if (!DOCUMENT_ALLOWED_MIME.has(file.type)) return { ok: false, code: "badFormat" };
  return { ok: true };
}
