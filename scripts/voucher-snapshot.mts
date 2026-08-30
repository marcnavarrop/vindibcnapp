/**
 * Genera el PDF del val de regal amb dades fixes, en un idioma o en els tres.
 *
 *   npx tsx scripts/voucher-snapshot.mts <carpeta> [ca|es|en]
 *
 * Sense idioma, els genera tots tres. Serveix per comparar el CONTINGUT abans
 * i després d'un canvi, i per mirar-los amb els ulls.
 *
 * El fitxer sencer no es pot comparar: pdf-lib hi posa `CreationDate` i
 * `ModDate` amb l'hora del moment, així que dues execucions separades per un
 * segon ja donen bytes diferents. L'empremta es calcula sobre els fluxos de
 * contingut descomprimits, sense les metadades —que és el que de debò es veu
 * al paper—.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { renderGiftVoucherPdf } from "../lib/invoices/gift-voucher-pdf";

const out = process.argv[2];
const only = process.argv[3] as "ca" | "es" | "en" | undefined;
if (!out) throw new Error("Cal indicar la carpeta de sortida.");
mkdirSync(out, { recursive: true });

const BASE = {
  code: "VINDI-AB12-CD34",
  // El nom del paquet NO es tradueix: és el que es va comprar, guardat.
  packageName: "Pack Benestar",
  serviceType: "ep_individual" as const,
  totalSessions: 5,
  expiresAt: "2026-12-31T12:00:00.000Z",
  buyerName: "Ana Ferrer",
  recipientName: "Laura",
  message: "Per molts anys! Que gaudeixis molt d'aquestes sessions.",
};

/**
 * Empremta del que es DIBUIXA a la pàgina.
 *
 * No es pot comparar el fitxer sencer: pdf-lib hi posa `CreationDate` i
 * `ModDate` amb l'hora del moment, i dues execucions separades per un segon ja
 * donen bytes diferents. Es busca el flux que porta els operadors de text
 * (`Tf`/`Tj`) —que és la pàgina— i es compara només aquest.
 */
function pageHash(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    try {
      const page = inflateSync(
        Buffer.from(raw.slice(start, end), "latin1"),
      ).toString("latin1");
      if (page.includes(" Tf") && page.includes(" Tj"))
        return createHash("sha1").update(page).digest("hex").slice(0, 16);
    } catch {
      /* flux no comprimit o binari: no és la pàgina */
    }
  }
  return "(no trobada)";
}

for (const locale of only ? [only] : (["ca", "es", "en"] as const)) {
  const bytes = await renderGiftVoucherPdf({ ...BASE, locale });
  const file = join(out, `val-regal-${locale}.pdf`);
  writeFileSync(file, bytes);
  console.log(`  ${locale}  pàgina=${pageHash(bytes)}  ${file}`);
}
