/**
 * La detecció del còdec dels vídeos d'exercicis (lib/video-codec.ts):
 *
 *   npm run videocodec:check
 *
 * Fitxers fets en memòria: la caixa `stsd` amb el còdec al principi (com
 * deixen els programes d'edició) o al final (com l'iPhone), enmig de soroll.
 */
import { detectVideoCodec } from "../lib/video-codec";

let bad = 0;
const ok = (c: boolean, m: string) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) bad++; };
const MB = 1024 * 1024;
const noise = (n: number) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 7 + 3) % 97; return b; };
const stsd = (codec: string) => new TextEncoder().encode(`\0\0\0\x20stsd\0\0\0\0\0\0\0\x01\0\0\0\x10${codec}\0\0\0\0`);
const blob = (...parts: Uint8Array[]) => new Blob(parts);

const cases: [string, Blob, string | null][] = [
  ["HEVC (hvc1) al final, 20 MB (iPhone)", blob(noise(20 * MB), stsd("hvc1")), "hevc"],
  ["HEVC (hev1) al principi", blob(stsd("hev1"), noise(10 * MB)), "hevc"],
  ["H.264 (avc1) al final, 45 MB", blob(noise(45 * MB), stsd("avc1")), "h264"],
  ["H.264 (avc1) al principi, petit", blob(stsd("avc1"), noise(1000)), "h264"],
  ["sense còdec reconegut", blob(noise(6 * MB)), null],
  ["HEVC enmig d'un fitxer gran (fora de les finestres): no es pot saber", blob(noise(10 * MB), stsd("hvc1"), noise(10 * MB)), null],
];
for (const [name, file, want] of cases) {
  const t = Date.now();
  const got = await detectVideoCodec(file);
  ok(got === want, `${name} → ${got ?? "desconegut"} (${Date.now() - t} ms)`);
}
console.log(bad ? `\n${bad} FALLADES` : "\nTot correcte.");
process.exit(bad ? 1 : 0);
