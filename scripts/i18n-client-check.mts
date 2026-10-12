/**
 * Cap component de client es queda sense els seus missatges.
 *
 *   npm run i18n:client      (també al `prebuild`)
 *
 * Des que cada `NextIntlClientProvider` envia només una llista de namespaces
 * (`lib/i18n/client-namespaces.ts`), un `useTranslations("nou")` en un
 * component de client que la llista no cobreixi sortiria a la pantalla com
 * `nou.clau`. Aquesta comprovació ho atura abans:
 *
 *   1. Per a cada àrea amb proveïdor, parteix de TOTES les seves entrades de
 *      Next (`page`, `layout`, `loading`, `error`, `not-found`, `template`) i
 *      segueix els imports, també els `import()` dinàmics (`next/dynamic`).
 *      Tot el que penja d'un mòdul "use client" és de client.
 *   2. FALLA si un d'aquests mòduls fa servir un namespace que la llista de la
 *      seva àrea no cobreix (una entrada cobreix la seva branca sencera).
 *   3. FALLA si en fa servir un que no es pot saber sense executar-lo
 *      (`useTranslations(variable)`): s'ha d'escriure amb un literal.
 *   4. FALLA si una entrada de la llista no existeix en algun dels tres
 *      diccionaris (ca/es/en).
 *   5. AVISA (no falla) si una entrada ja no la fa servir ningú: es pot treure.
 *
 *   6. FALLA si un component de client amb `useTranslations` es carrega també
 *      des de FORA dels proveïdors (l'admin i el professional) i no és a
 *      `KNOWN_OUTSIDE`. Els d'avui hi conviuen perquè la part traduïda només es
 *      munta per al rol client: és una protecció en temps d'execució que això
 *      no pot veure, i per això cada un hi és amb el seu motiu.
 */
import fs from "node:fs";
import path from "node:path";
import { PROVIDER_NAMESPACES } from "../lib/i18n/client-namespaces";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENTRY = /(?:^|\/)(page|layout|loading|error|not-found|template|global-error)\.tsx?$/;
const EXTS = ["", ".tsx", ".ts", "/index.tsx", "/index.ts"];

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null; // paquets: no hi ha components nostres
  for (const e of EXTS) {
    const f = base + e;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

type Info = { isClient: boolean; deps: string[]; ns: string[]; dynamicNs: number };
const cache = new Map<string, Info>();
function info(f: string): Info {
  const hit = cache.get(f);
  if (hit) return hit;
  const src = fs.readFileSync(f, "utf8");
  const isClient = /^\s*(["'])use client\1/m.test(src.slice(0, 300));
  const specs = [
    ...src.matchAll(/(?:^|[\s;])(?:import|export)\s[^"'`;]*?from\s+["']([^"']+)["']/g),
    ...src.matchAll(/(?:^|[\s;])import\s+["']([^"']+)["']/g),
    ...src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
  const deps = specs.map((s) => resolve(f, s)).filter((x): x is string => !!x);
  const ns = [...src.matchAll(/useTranslations\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  // Crides amb alguna cosa que no és un literal (o sense argument).
  const all = [...src.matchAll(/useTranslations\(([^)]*)\)/g)].length;
  const r = { isClient, deps, ns, dynamicNs: all - ns.length };
  cache.set(f, r);
  return r;
}

const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : /\.(tsx|ts)$/.test(e.name) ? [path.join(d, e.name)] : [],
  );

/** Els mòduls de client a què s'arriba des d'aquestes entrades. */
function clientModules(entries: string[]): Set<string> {
  const out = new Set<string>();
  const seen = new Set<string>();
  const visit = (f: string, inClient: boolean) => {
    const k = `${f}#${inClient}`;
    if (seen.has(k)) return;
    seen.add(k);
    const i = info(f);
    const c = inClient || i.isClient;
    if (c) out.add(f);
    for (const d of i.deps) visit(d, c);
  };
  entries.forEach((f) => visit(f, false));
  return out;
}

const covers = (entry: string, ns: string) => ns === entry || ns.startsWith(entry + ".");
const rel = (f: string) => path.relative(ROOT, f);
const dicts = Object.fromEntries(
  ["ca", "es", "en"].map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${l}.json`), "utf8"))]),
);
const exists = (msgs: unknown, ns: string) =>
  ns.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), msgs) !== undefined;

let fails = 0;
const fail = (m: string) => {
  console.log(`  ✗ ${m}`);
  fails++;
};
const providerDirs = Object.keys(PROVIDER_NAMESPACES).map((d) => path.join(ROOT, d));

for (const [dir, list] of Object.entries(PROVIDER_NAMESPACES)) {
  const entries = walk(path.join(ROOT, dir)).filter((f) => ENTRY.test(f));
  const mods = clientModules(entries);
  const used = new Map<string, Set<string>>();
  for (const f of mods) {
    const i = info(f);
    if (i.dynamicNs > 0) fail(`${rel(f)}: useTranslations sense un literal; escriu el namespace tal qual`);
    for (const n of i.ns) {
      if (!used.has(n)) used.set(n, new Set());
      used.get(n)!.add(rel(f));
    }
  }
  console.log(`\n${dir} · ${entries.length} entrades · ${mods.size} mòduls de client · ${used.size} namespaces · ${list.length} a la llista`);
  let ok = true;
  for (const [n, files] of used)
    if (!list.some((e) => covers(e, n))) {
      ok = false;
      fail(`«${n}» no és a la llista de ${dir} (el fa servir ${[...files].join(", ")}): afegeix-lo a lib/i18n/client-namespaces.ts`);
    }
  for (const e of list)
    for (const [l, d] of Object.entries(dicts))
      if (!exists(d, e)) {
        ok = false;
        fail(`«${e}» és a la llista de ${dir} però no existeix a messages/${l}.json`);
      }
  for (const e of list)
    if (![...used.keys()].some((n) => covers(e, n))) console.log(`  · avís: «${e}» ja no el fa servir cap component de client de ${dir}; es pot treure`);
  if (ok) console.log("  ✓ tots els namespaces que fan servir hi són, i existeixen en els tres idiomes");
}

// Fora dels proveïdors. Cap d'aquests no té `NextIntlClientProvider` a sobre:
// un `useTranslations` que s'hi muntés de debò petaria la pantalla. Els que hi
// ha avui hi conviuen perquè la part traduïda només es munta per al rol client
// (o reben els textos com a dades). Qualsevol de NOU s'atura aquí fins que algú
// el miri i l'afegeixi a la llista amb el seu motiu.
const KNOWN_OUTSIDE: Record<string, string> = {
  "components/app-sidebar.tsx": "NavLabel, LegalLabel i TranslatedSignOut només es munten per al rol client",
  "components/community-badge.tsx": "el menú només el munta a les entrades del client",
  "components/bonos-badge.tsx": "el menú només el munta a les entrades del client",
  "components/exercises-badge.tsx": "el menú només el munta a les entrades del client",
  "components/center-contact-line.tsx": "la versió traduïda només surt a l'àrea del client i a les públiques",
  "components/forms/change-password-form.tsx": "embolcall traduït per al client i un altre en català per a l'equip",
  "components/forms/notification-preferences-form.tsx": "embolcall traduït per al client i un altre en català per a l'equip",
  "components/exercise-library.tsx": "l'equip li passa els textos com a dades (LIBRARY_TEXTS_CA)",
};
const outsideEntries = walk(path.join(ROOT, "app")).filter(
  (f) => ENTRY.test(f) && !providerDirs.some((d) => f.startsWith(d + path.sep)),
);
const outside = [...clientModules(outsideEntries)].filter((f) => info(f).ns.length > 0).map(rel);
console.log(`\nFora dels proveïdors (admin, professional, arrel): ${outside.length} components de client amb useTranslations.`);
for (const f of outside)
  if (KNOWN_OUTSIDE[f]) console.log(`  · ${f}: ${KNOWN_OUTSIDE[f]}`);
  else fail(`${f} fa servir useTranslations i es carrega també fora dels proveïdors (admin o professional), on el hook petaria. Mira'l a mà i, si és segur, afegeix-lo a KNOWN_OUTSIDE amb el motiu`);
for (const f of Object.keys(KNOWN_OUTSIDE))
  if (!outside.includes(f)) console.log(`  · avís: ${f} ja no hi és; es pot treure de KNOWN_OUTSIDE`);

console.log(fails ? `\n${fails} problemes.` : "\nTot correcte.");
process.exit(fails ? 1 : 0);
