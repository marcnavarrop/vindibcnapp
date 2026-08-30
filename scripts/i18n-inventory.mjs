// Què queda sense traduir a l'ÀREA DE CLIENT.
// Es parteix de app/(client) i es segueixen els imports interns, per no
// endevinar quins components hi arriben —que és com em vaig equivocar amb el
// support-fab, que ni tan sols el veu el client.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const seen = new Set(), queue = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) queue.push(p);
  }
}
walk("app/(client)");
walk("app/prova");

const resolve = (spec) => {
  if (!spec.startsWith("@/")) return null;
  const base = spec.slice(2);
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"])
    if (existsSync(base + ext)) return base + ext;
  return null;
};

while (queue.length) {
  const f = queue.shift();
  if (seen.has(f)) continue;
  seen.add(f);
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/from\s+"(@\/[^"]+)"/g)) {
    const r = resolve(m[1]);
    if (r && !seen.has(r)) queue.push(r);
  }
}

// Text català a pèl: text de JSX o props de cadena que semblin una frase.
const CAT = /[àèéíòóúïüçÀÈÉÍÒÓÚÇ]|\b(el|la|els|les|un|una|de|del|que|amb|per|no|teu|teva|meu|seva)\b/i;
/**
 * Fitxers que el graf d'imports toca però que el CLIENT no arriba a veure mai.
 * L'import no és el que mana: la guarda de render, sí. Van amb el motiu escrit
 * perquè no s'hagi de tornar a deduir —jo mateix em vaig equivocar amb el
 * support-fab per llegir l'import i no la guarda del costat.
 */
const NOT_RENDERED_TO_CLIENTS = {
  "components/support-fab.tsx":
    "app-shell el munta amb `role !== \"client\"`; a més la RLS de la 0047 " +
    "exigeix is_admin() o is_trainer() per obrir un tiquet.",
  "components/app-sidebar.tsx":
    "els dos literals que hi queden són a les branques `role !== \"client\"`; " +
    "el client passa per TranslatedMenuButton i TranslatedCloseButton.",
};

const findings = [];
for (const f of [...seen].sort()) {
  if (/^lib\/|^types\/|\.d\.ts$/.test(f)) continue;
  const src = readFileSync(f, "utf8");
  const translated = /use(Translations|Locale)|getTranslations/.test(src);
  const hits = [];
  for (const m of src.matchAll(/>\s*([A-ZÀ-Ú][^<>{}\n]{6,})\s*</g))
    if (CAT.test(m[1])) hits.push(m[1].trim());
  for (const m of src.matchAll(/(?:label|placeholder|title|aria-label|pendingLabel)="([^"]{6,})"/g))
    if (CAT.test(m[1])) hits.push(`[prop] ${m[1]}`);
  if (hits.length) findings.push({ f, translated, hits: [...new Set(hits)] });
}

console.log(`Fitxers accessibles des de l'àrea de client: ${seen.size}\n`);

const guarded = findings.filter((x) => NOT_RENDERED_TO_CLIENTS[x.f]);
const pending = findings.filter((x) => !NOT_RENDERED_TO_CLIENTS[x.f]);

console.log(
  pending.length
    ? `PENDENT DE TRADUIR: ${pending.length} fitxer(s)\n`
    : "PENDENT DE TRADUIR: res.\n",
);
for (const x of pending) {
  console.log(`${x.translated ? "◐" : "✗"} ${x.f}`);
  for (const h of x.hits.slice(0, 4)) console.log(`     ${h.slice(0, 78)}`);
  if (x.hits.length > 4) console.log(`     …i ${x.hits.length - 4} més`);
}

if (guarded.length) {
  console.log("\nAmb text català, però que el client no veu mai:");
  for (const x of guarded)
    console.log(`  · ${x.f}\n      ${NOT_RENDERED_TO_CLIENTS[x.f]}`);
}
