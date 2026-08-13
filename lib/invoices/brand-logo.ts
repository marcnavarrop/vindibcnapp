import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { PDFDocument, PDFImage } from "pdf-lib";

/**
 * El logotip oficial per als PDF que generem.
 *
 * És EL MATEIX fitxer que fa servir tota la resta de l'app —el `Wordmark` del
 * sidebar i del login, i la capçalera dels correus—, i viu en un sol lloc
 * perquè no es pugui tornar a separar: la marca ja s'havia vist de dues
 * maneres segons la pantalla i no ha de tornar a passar.
 *
 * Es llegeix del disc i no per HTTP: generar un document no pot dependre que
 * l'app es pugui cridar a si mateixa. A Vercel, `public/` el serveix la CDN i
 * no forma part del sistema de fitxers de la funció, així que el fitxer viatja
 * dins del paquet per `outputFileTracingIncludes` (next.config.ts) — sense
 * això, `readFile` falla en silenci a producció i funciona en local.
 *
 * Si el fitxer no hi fos, torna null i qui el dibuixa escriu el nom: val més
 * un document sense logo que cap document.
 */
export const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "logo-vindi.png",
);

export async function embedBrandLogo(
  doc: PDFDocument,
): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(await fs.readFile(LOGO_PATH));
  } catch {
    return null;
  }
}

/** Amplada que li toca a una alçada donada, sense deformar-lo. */
export function logoWidthFor(logo: PDFImage, height: number): number {
  return (logo.width / logo.height) * height;
}
