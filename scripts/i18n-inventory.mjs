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
if (!findings.length) console.log("Cap text català a pèl.");
for (const x of findings) {
  console.log(`${x.translated ? "◐" : "✗"} ${x.f}`);
  for (const h of x.hits.slice(0, 4)) console.log(`     ${h.slice(0, 78)}`);
  if (x.hits.length > 4) console.log(`     …i ${x.hits.length - 4} més`);
}
