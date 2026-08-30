/**
 * Munta una pàgina per revisar els correus: cada plantilla, els tres idiomes
 * de costat, tal com es veuran a la safata.
 *
 *   npm run emails:review <cat|ca> <cat|es> <cat|en> <sortida.html>
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const [CA, ES, EN, OUT] = process.argv.slice(2);
const names = readdirSync(CA).filter((f) => f.endsWith(".html")).map((f) => basename(f, ".html")).sort();
const read = (d, n, ext) => { try { return readFileSync(join(d, `${n}.${ext}`), "utf8"); } catch { return ""; } };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Els que van a l'admin, al professional, a un visitant o al desenvolupador
 * es queden en català a posta, i els dos correus de compte també (encara no
 * hi ha idioma triat). Han de sortir IGUALS a les tres columnes: si no, és
 * que se n'ha escapat un.
 */
const CATALAN_ON_PURPOSE = new Set([
  "trial_request","trial_status","trial_status__rejected",
  "trainer_booking_received","trainer_booking_cancelled",
  "trainer_daily_agenda","trainer_daily_agenda__buida",
  "new_client_registered","invoice_generated","support_ticket_created",
  "auth_invite","auth_recovery",
]);
const TRANSLATED = { has: (n) => !CATALAN_ON_PURPOSE.has(n) };

const cards = names.map((n) => {
  const cols = [["Català", CA], ["Castellano", ES], ["English", EN]].map(([label, dir]) => {
    const html = read(dir, n, "html");
    const subj = read(dir, n, "subject.txt").trim();
    return `<div class="col">
      <div class="lang">${label}</div>
      <div class="subj" title="${esc(subj)}">${esc(subj) || "—"}</div>
      <iframe srcdoc="${esc(html)}" loading="lazy"></iframe>
    </div>`;
  }).join("");
  const done = TRANSLATED.has(n);
  return `<section id="${n}">
    <h2>${n} <span class="tag ${done ? "ok" : "pend"}">${done ? "traduït" : "català a posta"}</span></h2>
    <div class="cols">${cols}</div>
  </section>`;
}).join("");

writeFileSync(OUT, `<!doctype html><html lang="ca"><head><meta charset="utf-8">
<title>Correus · revisió en tres idiomes</title><style>
:root{color-scheme:light}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f2f5;color:#2b2b2b}
header{position:sticky;top:0;background:#642263;color:#fff;padding:14px 20px;z-index:10}
header h1{margin:0;font-size:17px}
header p{margin:4px 0 0;font-size:12px;opacity:.8}
nav{padding:12px 20px;background:#fff;border-bottom:1px solid #e5e0e6;display:flex;flex-wrap:wrap;gap:6px}
nav a{font-size:11px;padding:3px 8px;border-radius:20px;background:#f4f2f5;color:#642263;text-decoration:none}
nav a.pend{background:#fdf0e6;color:#c24d0d}
section{padding:20px;border-bottom:1px solid #e5e0e6}
h2{margin:0 0 12px;font-size:14px;font-family:ui-monospace,Menlo,monospace;color:#642263}
.tag{font-family:-apple-system,sans-serif;font-size:10px;padding:2px 8px;border-radius:20px;vertical-align:middle;margin-left:6px}
.tag.ok{background:#e3f5e8;color:#1c7a3c}.tag.pend{background:#fdf0e6;color:#c24d0d}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:1000px){.cols{grid-template-columns:1fr}}
.col{background:#fff;border:1px solid #e5e0e6;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.lang{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:8px 12px;background:#faf9fb;color:#8b8391;border-bottom:1px solid #e5e0e6}
.subj{padding:8px 12px;font-size:12px;font-weight:700;border-bottom:1px solid #e5e0e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
iframe{width:100%;height:600px;border:0;background:#fff}
</style></head><body>
<header><h1>Correus de VindiBCN · els tres idiomes de costat</h1>
<p>${names.length} plantilles. Les marcades «català a posta» van a l&rsquo;equip, a un visitant o al desenvolupador: han de sortir IGUALS a les tres columnes.</p></header>
<nav>${names.map((n) => `<a href="#${n}" class="${TRANSLATED.has(n) ? "" : "pend"}">${n}</a>`).join("")}</nav>
${cards}</body></html>`);
console.log(`${names.length} plantilles × 3 idiomes → ${OUT}`);
