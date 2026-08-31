/**
 * Captura el text VISIBLE de les pàgines legals, tal com el serveix el
 * servidor, i l'escriu a disc. Serveix per comparar abans i després d'un
 * canvi: en un text amb valor jurídic, el català aprovat no s'ha de moure ni
 * una coma.
 *
 *   node scripts/legal-snapshot.mjs <carpeta> [ca|es|en]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out, locale = "ca"] = process.argv.slice(2);
if (!out) throw new Error("Cal indicar la carpeta de sortida.");
mkdirSync(out, { recursive: true });

const PAGES = ["avis-legal", "privacitat", "cookies"];
const BASE = process.env.LEGAL_BASE ?? "http://localhost:3100";

/** Text pla a partir de l'HTML: només el que llegeix una persona. */
function toText(html) {
  const main = html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"));
  return main
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<\/(h1|h2|h3|p|li|div)>/g, "\n")
    .replace(/<li[^>]*>/g, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&middot;/g, "·")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean)
    .join("\n");
}

for (const page of PAGES) {
  const res = await fetch(`${BASE}/legal/${page}`, {
    headers: { Cookie: `vindi_locale=${locale}` },
  });
  if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
  const text = toText(await res.text());
  writeFileSync(join(out, `${page}.${locale}.txt`), text + "\n");
  console.log(`  ${page.padEnd(14)} ${locale}  ${text.split("\n").length} línies`);
}
