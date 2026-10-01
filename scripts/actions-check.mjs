#!/usr/bin/env node
/**
 * Cap acció de servidor nova sense mirar qui la crida.
 *
 *   npm run actions:check
 *
 * Una acció de servidor ("use server") es pot invocar pel seu id des de
 * QUALSEVOL pàgina amb un POST: el middleware de /admin/* o /trainer/* no la
 * protegeix. Les que escriuen amb la clau de servei no tenen cap altra
 * barrera, i les que van amb la sessió depenen només de la RLS.
 *
 * Aquest script llegeix (amb el compilador de TypeScript) cada fitxer
 * "use server" de `app/` i `lib/` i exigeix que cada funció exportada:
 *
 *   · cridi `requireRole(` o `getViewer(` al seu cos, o
 *   · cridi una funció del MATEIX fitxer que ho faci (p. ex. `isAdmin()`), o
 *   · sigui a `scripts/public-actions.json` amb el motiu: les públiques a
 *     propòsit (registre, recuperar la contrasenya, demanar una prova…).
 *
 * Falla si n'hi ha alguna que no compleix res d'això, i si la llista de
 * públiques té entrades que ja no existeixen. Corre al `prebuild`.
 *
 * Mirar el rol no vol dir mirar-lo BÉ (un professional amb un client que no és
 * seu, per exemple): això ho prova `npm run roles:check`, en simulació.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(ROOT, "scripts/public-actions.json");
const CHECKS = /\b(requireRole|getViewer)\s*\(/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "mock") walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const isExported = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

const found = new Map(); // "fitxer::acció" → { ok, line }
for (const file of [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "lib"))]) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const first = sf.statements[0];
  const isServer =
    first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use server";
  if (!isServer) continue;

  // Funcions locals (no exportades) que miren el rol: es poden fer servir de porta.
  const localGuards = new Set();
  for (const n of sf.statements)
    if (ts.isFunctionDeclaration(n) && n.name && !isExported(n) && n.body && CHECKS.test(n.body.getText()))
      localGuards.add(n.name.text);
  const guardCall = localGuards.size ? new RegExp(`\\b(${[...localGuards].join("|")})\\s*\\(`) : null;

  for (const n of sf.statements) {
    if (!ts.isFunctionDeclaration(n) || !n.name || !isExported(n)) continue;
    const body = n.body?.getText() ?? "";
    const ok = CHECKS.test(body) || (guardCall?.test(body) ?? false);
    const rel = path.relative(ROOT, file);
    found.set(`${rel}::${n.name.text}`, { ok, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
  }
}

const pub = JSON.parse(fs.readFileSync(PUBLIC, "utf8"));
const problems = [];
for (const [key, f] of found) {
  if (f.ok) {
    if (pub[key]) problems.push(`${key}: ja mira el rol; treu-la de public-actions.json.`);
    continue;
  }
  if (pub[key]) {
    if (!pub[key].reason || pub[key].reason.length < 10) problems.push(`${key}: falta el motiu a public-actions.json`);
    continue;
  }
  const [file, name] = key.split("::");
  problems.push(
    `SENSE COMPROVACIÓ: ${file}:${f.line} — ${name}() no crida requireRole ni getViewer.\n` +
      `    Posa-hi \`const viewer = await requireRole("admin" | "trainer" | ...); if (!viewer) return …\` a la primera línia,\n` +
      `    o, si és pública a propòsit, anota-la a scripts/public-actions.json amb el motiu.`,
  );
}
for (const key of Object.keys(pub))
  if (!found.has(key)) problems.push(`JA NO EXISTEIX: ${key} — treu-la de public-actions.json.`);

if (process.argv.includes("--list")) {
  for (const [k, f] of [...found].sort()) console.log(`${f.ok ? "✓" : pub[k] ? "·" : "✗"} ${k}`);
}
if (problems.length) {
  console.error(`✗ ${problems.length} problemes:\n\n${problems.map((p) => `  · ${p}`).join("\n")}\n`);
  process.exit(1);
}
const nPub = Object.keys(pub).length;
console.log(`✓ ${found.size} accions de servidor: ${found.size - nPub} miren qui les crida i ${nPub} són públiques a propòsit.`);
