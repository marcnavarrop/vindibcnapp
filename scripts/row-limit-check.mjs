#!/usr/bin/env node
/**
 * Cap llista nova sense límit.
 *
 *   npm run rows:check            comprova
 *   npm run rows:check -- --list  ensenya totes les lectures sense límit trobades
 *
 * Supabase talla cada lectura a 1000 files (Settings → API → Max rows) i NO ho
 * diu: la pantalla pinta 1000 i prou. Aquest script busca, a `lib/` i `app/`,
 * cada consulta `.from("taula")…select(…)` que no porta `.limit(`, `.range(`,
 * `.single(`, `.maybeSingle(` ni `head: true`, i exigeix que sigui a la llista
 * `scripts/row-limit-allowlist.json` amb el seu motiu:
 *
 *   · "acotada": va filtrada de manera que no pot créixer amb el centre (per
 *     id, per client, per sèrie, per una finestra de dates, una taula de
 *     configuració…). El motiu diu per què.
 *   · "pendent": una llista que creix amb el centre i encara ho porta tot. Es
 *     passarà a pàgines (cursor, «Carregar més», comptador) quan el log digui
 *     que s'acosta al sostre («resposta de N files, s'acosta», row-cap.ts, a
 *     partir de 500).
 *
 * Falla si hi ha una lectura sense límit que no és a la llista (n'acabes
 * d'afegir una: posa-li límit o anota-la amb el motiu) i si la llista té
 * entrades que ja no existeixen (s'ha arreglat o s'ha mogut: treu-la).
 *
 * COM LLEGEIX EL CODI
 *
 * Amb el compilador de TypeScript, no amb expressions regulars sobre el text:
 * comentaris, cadenes i expressions regulars del codi no el confonen. Per a
 * cada crida `.from("…")` puja per la cadena de mètodes (`.select().eq()…`) i
 * en llegeix els noms. Si la consulta es desa en una variable i el límit hi
 * arriba més avall (`q = q.limit(…)`, també dins d'un `if`), compta com a
 * limitada. La clau és fitxer + funció declarada + taula, no la línia: moure
 * codi no la trenca. Dues lectures iguals a la mateixa funció → `"count": 2`.
 *
 * Límits coneguts: una taula que arriba en una variable i no en un literal no
 * es veu, i les funcions de la base (`rpc`) no hi entren (tornen el que la
 * funció decideix).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ALLOW = path.join(ROOT, "scripts/row-limit-allowlist.json");
const LIMITING = new Set(["limit", "range", "single", "maybeSingle"]);
const WRITING = new Set(["insert", "update", "delete", "upsert"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "mock") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Els noms dels mètodes de la cadena, pujant des de `.from(...)`, i el node de dalt. */
function chainUp(fromCall) {
  const names = [];
  let node = fromCall;
  for (;;) {
    const p = node.parent;
    if (p && ts.isPropertyAccessExpression(p) && p.expression === node) {
      names.push(p.name.text);
      const pp = p.parent;
      if (pp && ts.isCallExpression(pp) && pp.expression === p) {
        // `head: true` a les opcions del select
        if (p.name.text === "select" && pp.arguments[1] && /head\s*:\s*true/.test(pp.arguments[1].getText())) names.push("head");
        node = pp;
        continue;
      }
      node = p;
      continue;
    }
    if (p && (ts.isAwaitExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p))) {
      node = p;
      continue;
    }
    return { names, top: node };
  }
}

/** Si la consulta es desa en una variable: el nom, per seguir-la. */
function assignedName(top) {
  const p = top.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(p.left)) return p.left.text;
  return null;
}

/** Dins de la funció, algun `nom = nom.…limit(…)…` o `nom.limit(…)`? */
function limitedLater(fn, name) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && LIMITING.has(n.expression.name.text)) {
      // baixa fins a l'arrel de la cadena: ha de ser la variable
      let root = n.expression.expression;
      while (ts.isCallExpression(root) || ts.isPropertyAccessExpression(root)) root = ts.isCallExpression(root) ? root.expression : root.expression;
      if (ts.isIdentifier(root) && root.text === name) found = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}

function enclosing(node) {
  let fnName = null, fnNode = null;
  for (let p = node.parent; p; p = p.parent) {
    const isFn = ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p);
    if (isFn && !fnNode) fnNode = p;
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) {
      fnName = p.name.getText();
      fnNode = p;
      break;
    }
  }
  return { fnName: fnName ?? "(mòdul)", fnNode: fnNode ?? node.getSourceFile() };
}

const found = new Map(); // key → {file, fn, table, lines:[]}
for (const file of [...walk(path.join(ROOT, "lib")), ...walk(path.join(ROOT, "app"))]) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(ROOT, file);
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "from" &&
      n.arguments.length === 1 &&
      ts.isStringLiteralLike(n.arguments[0])
    ) {
      const table = n.arguments[0].text;
      const { names, top } = chainUp(n);
      const reads = names.includes("select");
      const limited = names.some((x) => LIMITING.has(x)) || names.includes("head");
      const writes = names.some((x) => WRITING.has(x));
      if (reads && !limited && !writes) {
        const { fnName, fnNode } = enclosing(n);
        const v = assignedName(top);
        if (!(v && limitedLater(fnNode, v))) {
          const key = `${rel}::${fnName}::${table}`;
          const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
          const e = found.get(key) ?? { file: rel, fn: fnName, table, lines: [] };
          e.lines.push(line);
          found.set(key, e);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

if (process.argv.includes("--list")) {
  for (const [k, e] of [...found].sort()) console.log(`${k}  (línies ${e.lines.join(", ")})`);
  process.exit(0);
}

const allow = JSON.parse(fs.readFileSync(ALLOW, "utf8"));
const problems = [];
for (const [key, e] of found) {
  const a = allow[key];
  if (!a) {
    problems.push(`NOVA SENSE LÍMIT: ${e.file}:${e.lines[0]} — ${e.fn}() llegeix «${e.table}» sense .limit/.range.\n    Posa-li límit (o pàgines) o anota-la a scripts/row-limit-allowlist.json amb "acotada" i el motiu.`);
    continue;
  }
  if (a.category !== "acotada" && a.category !== "pendent")
    problems.push(`${key}: categoria «${a.category}» (ha de ser "acotada" o "pendent")`);
  if (!a.reason || a.reason.length < 10) problems.push(`${key}: falta el motiu`);
  if ((a.count ?? 1) !== e.lines.length)
    problems.push(`${key}: la llista diu ${a.count ?? 1} i n'hi ha ${e.lines.length} (línies ${e.lines.join(", ")})`);
}
for (const key of Object.keys(allow))
  if (!found.has(key)) problems.push(`JA NO EXISTEIX: ${key} — s'ha arreglat o s'ha mogut; treu-la de la llista.`);

const pend = Object.entries(allow).filter(([, a]) => a.category === "pendent");
if (problems.length) {
  console.error(`✗ ${problems.length} problemes:\n\n${problems.map((p) => `  · ${p}`).join("\n")}\n`);
  process.exit(1);
}
console.log(`✓ ${found.size} lectures sense límit, totes anotades: ${found.size - pend.length} acotades i ${pend.length} pendents de passar a pàgines.`);
console.log(`  Pendents (quan el log digui «s'acosta al sostre»):\n${pend.map(([k, a]) => `    · ${k.split("::").slice(1).join(" → ")}: ${a.reason}`).join("\n")}`);
