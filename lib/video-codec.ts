/**
 * Quin còdec porta un vídeo MP4/MOV, sense descodificar-lo.
 *
 * Per què: un vídeo HEVC (H.265, el format normal de l'iPhone) només es veu a
 * Safari (iPhone i Mac); Chrome i Firefox el rebutgen (provat el 13/10/2026).
 * El formulari d'exercicis avisa en triar-lo, sense bloquejar.
 *
 * Com: el còdec és escrit, com a quatre lletres, dins la descripció de la
 * pista (la caixa `stsd` del `moov`): `hvc1`/`hev1` per a HEVC, `avc1`/`avc3`
 * per a H.264. L'iPhone posa el `moov` al FINAL del fitxer i altres programes
 * al principi, així que es llegeixen els primers i els últims 4 MB i s'hi
 * busquen aquestes lletres. No cal llegir el vídeo sencer (en pot fer 50).
 *
 * Mòdul pur (sense `"use client"` ni `server-only`): el fa servir el
 * formulari i el comprova `npm run videocodec:check`.
 */
export type VideoCodec = "hevc" | "h264" | null;

const WINDOW = 4 * 1024 * 1024;

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const HEVC = [ascii("hvc1"), ascii("hev1")];
const H264 = [ascii("avc1"), ascii("avc3")];

function contains(bytes: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

export async function detectVideoCodec(file: Blob): Promise<VideoCodec> {
  const head = new Uint8Array(await file.slice(0, Math.min(WINDOW, file.size)).arrayBuffer());
  const tail =
    file.size > WINDOW
      ? new Uint8Array(await file.slice(Math.max(WINDOW, file.size - WINDOW)).arrayBuffer())
      : new Uint8Array(0);
  for (const part of [head, tail]) {
    if (HEVC.some((n) => contains(part, n))) return "hevc";
  }
  for (const part of [head, tail]) {
    if (H264.some((n) => contains(part, n))) return "h264";
  }
  return null;
}
