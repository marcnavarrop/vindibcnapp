import fs from "node:fs"; import path from "node:path"; import ts from "typescript";
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "mock") walk(p, o); } else if (/\.(ts|tsx)$/.test(e.name)) o.push(p); } return o; };
const defs = new Map();
for (const f of walk("lib")) { const t = fs.readFileSync(f, "utf8"); const sf = ts.createSourceFile(f, t, ts.ScriptTarget.Latest, true);
  sf.forEachChild((n) => { if (ts.isFunctionDeclaration(n) && n.name) defs.set(n.name.text, { file: f, body: n.body?.getText() ?? "" }); }); }
const names = process.argv.slice(2);
for (const n of names) { const d = defs.get(n); if (!d) { console.log(`${n}: (no és a lib)`); continue; }
  const b = d.body.replace(/USE_MOCK[\s\S]*?\n  }\n/, "");
  const flags = [ /createAdminClient\(/.test(d.body) && "SERVEI", /createClient\(/.test(d.body) && "sessió", /getViewer|requireRole|is_admin|role\s*!==|role\s*===/.test(d.body) && "MIRA-ROL", /\.rpc\(/.test(d.body) && `rpc:${[...d.body.matchAll(/\.rpc\("(\w+)"/g)].map(m=>m[1]).join("/")}` ].filter(Boolean);
  const inner = [...new Set([...d.body.matchAll(/\bawait\s+(\w+)\(/g)].map((m) => m[1]))].filter((x) => defs.has(x) && x !== n);
  console.log(`${n.padEnd(28)} ${d.file.replace("lib/data/","")} · ${flags.join(" ") || "-"}${inner.length ? " · crida: " + inner.join(", ") : ""}`); }
