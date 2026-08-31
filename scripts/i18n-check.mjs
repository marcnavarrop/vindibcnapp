/**
 * Comprova el diccionari abans de cada push.
 *
 * Fa dues coses que la compilació no fa:
 *  1. Que tota clau `t("…")` del codi existeixi al diccionari, resolent el
 *     `t` contra el `useTranslations`/`getTranslations` més proper de sobre.
 *  2. Que ca, es i en tinguin exactament el mateix arbre de claus.
 *
 * El que NO pot fer és trobar text català escrit a pèl dins del JSX: això
 * només surt mirant la pantalla. Ha passat prou vegades per deixar-ho escrit.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const DICTS = ["ca", "es", "en"];
const load = (l) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const dicts = Object.fromEntries(DICTS.map((l) => [l, load(l)]));

const at = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

const BIND =
  /(?:const|let)\s+(?:(\w+)|\[([^\]]+)\])\s*=\s*(?:await\s+)?(?:Promise\.all\(\[([\s\S]*?)\]\)|(?:use|get)Translations\(\s*"([^"]+)"\s*\))/g;

/**
 * Els correus no fan servir `useTranslations`: no es renderitzen dins de cap
 * petició. Van per `i.ns("emails.…")`, de lib/notifications/i18n.ts. Sense
 * aquesta segona forma, les claus dels correus no les comprovaria ningú.
 */
const BIND_NS = /(?:const|let)\s+(\w+)\s*=\s*\w+\.ns\(\s*"([^"]+)"\s*\)/g;

const missing = [];
let used = 0;

for (const file of walk(".")) {
  const src = readFileSync(file, "utf8");
  // Binding → espai de noms, amb la posició on es declara.
  const binds = [];
  for (const m of src.matchAll(BIND)) {
    if (m[4]) binds.push({ name: m[1], ns: m[4], at: m.index });
    else if (m[2] && m[3]) {
      // const [a, b] = await Promise.all([getTranslations("x"), …])
      const names = m[2].split(",").map((s) => s.trim());
      const nss = [...m[3].matchAll(/(?:use|get)Translations\(\s*"([^"]+)"\s*\)/g)].map(
        (x) => x[1],
      );
      names.forEach((n, i) => nss[i] && binds.push({ name: n, ns: nss[i], at: m.index }));
    }
  }
  for (const m of src.matchAll(BIND_NS))
    binds.push({ name: m[1], ns: m[2], at: m.index });

  if (!binds.length) continue;

  // `t("x")` però també `t.rich("x")` i `t.raw("x")`: el grup opcional es prova
  // abans que el nom nu, així que la crida amb punt no s'escapa com a "rich".
  for (const call of src.matchAll(
    /\b(\w+)(?:\.(?:rich|raw|markup))?\(\s*"([^"]+)"/g,
  )) {
    const [, name, key] = call;
    // El binding vigent és l'últim declarat abans d'aquesta crida.
    const bind = binds.filter((b) => b.name === name && b.at < call.index).pop();
    if (!bind) continue;
    used++;
    const full = `${bind.ns}.${key}`;
    const val = at(dicts.ca, full);
    // Una llista val (els noms dels dies); un objecte no: seria un espai de
    // noms sencer, i això vol dir que la clau apunta massa amunt.
    if (typeof val !== "string" && !Array.isArray(val))
      missing.push(`${file}: ${name}("${key}") → ${full}`);
  }
}

/*
 * Apòstrofe just abans d'una etiqueta.
 *
 * A l'ICU MessageFormat l'apòstrofe és un caràcter d'escapament: "d'<b>text</b>"
 * obre una cita literal i es menja l'apòstrofe I l'etiqueta, en silenci, fins
 * a la següent apòstrofe. Va passar de debò al text legal —"els drets d'accés"
 * va sortir com "els drets daccés"—, i en un document amb valor jurídic això
 * no es pot detectar només mirant. Doblada ('') es dibuixa bé.
 */
const icuTraps = [];
for (const l of ["ca", "es", "en"]) {
  const walk = (o, path = "") => {
    for (const [k, v] of Object.entries(o)) {
      const at = path ? `${path}.${k}` : k;
      if (v && typeof v === "object") walk(v, at);
      else if (typeof v === "string" && /(^|[^'])'</.test(v))
        icuTraps.push(`${l}: ${at} — apòstrofe sense doblar just abans d'una etiqueta`);
    }
  };
  walk(dicts[l]);
}

// Paritat: mateix arbre de claus als tres.
const keysOf = (o, p = "", acc = []) => {
  for (const [k, v] of Object.entries(o)) {
    const path = p ? `${p}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keysOf(v, path, acc);
    else acc.push(path);
  }
  return acc;
};
const base = new Set(keysOf(dicts.ca));
const parity = [];
for (const l of ["es", "en"]) {
  const other = new Set(keysOf(dicts[l]));
  for (const k of base) if (!other.has(k)) parity.push(`${l}: falta ${k}`);
  for (const k of other) if (!base.has(k)) parity.push(`${l}: sobra ${k}`);
}

console.log(`${used} claus usades · ${base.size} al diccionari`);
for (const m of missing) console.log("  ✗ " + m);
for (const p of parity) console.log("  ✗ " + p);
for (const t of icuTraps) console.log("  ✗ " + t);
if (missing.length || parity.length || icuTraps.length) {
  console.log(
    `\n${missing.length} sense resoldre · ${parity.length} de paritat · ${icuTraps.length} trampes d'ICU`,
  );
  process.exit(1);
}
console.log("Tot resol i els tres diccionaris són bessons.");
