/**
 * L'hora del centre no ha canviat amb els formatadors reaprofitats.
 *
 *   npm run tz:check
 *
 * `lib/center-time.ts` decideix l'hora del centre per a tota l'app. A
 * l'octubre del 2026 es va canviar com la calcula (un formatador creat un cop
 * en comptes d'un per crida, i el desfasament un cop per dia), i aquesta
 * comprovació demostra que el que torna és EXACTAMENT el mateix que abans.
 * Aquí dins hi ha una còpia literal del codi d'abans, i es comparen:
 *
 *   · `centerLocalToInstant`: cada minut de rellotge (00:00…23:59) de cada dia
 *     del 2026, més els dos canvis d'hora del 2027, contra el codi d'abans i
 *     contra una referència independent (vegeu més avall per què totes dues). Hi entren l'hora que no
 *     existeix (02:00–02:59 de l'últim diumenge de març) i la que passa dues
 *     vegades (02:00–02:59 de l'últim diumenge d'octubre).
 *   · `toCenterLocal`, `centerDateStr`, `centerHour`, `centerSlot` i
 *     `centerWeekday`: cada minut de l'any, com a instant real (525.600).
 *   · `datetimeLocalToInstant` amb entrades bones i dolentes.
 *   · Que repetir una conversió (la memòria del dia) torna el mateix.
 *
 * El `package.json` la fa córrer amb el procés en UTC (com Vercel), cada minut,
 * i a Europe/Madrid i America/New_York, cada mitja hora: cap d'aquestes
 * funcions ha de dependre de la zona del procés.
 */
import { CENTER_TZ } from "../lib/config";
import { slotOf } from "../lib/availability-slots";
import * as now from "../lib/center-time";

// ─── EL CODI D'ABANS, COPIAT TAL QUAL (commit 2b499ac) ──────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
function oldToCenterLocal(utcDate: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
  );
}
function oldCenterDateStr(utcDate: Date): string {
  const d = oldToCenterLocal(utcDate);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const oldCenterHour = (d: Date) => oldToCenterLocal(d).getUTCHours();
function oldCenterSlot(utcDate: Date): number {
  const d = oldToCenterLocal(utcDate);
  return slotOf(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`);
}
const oldCenterWeekday = (d: Date) => (oldToCenterLocal(d).getUTCDay() + 6) % 7;
function oldCenterOffsetMs(at: Date): number {
  const asUTC = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  const asCenter = new Date(at.toLocaleString("en-US", { timeZone: CENTER_TZ }));
  return asCenter.getTime() - asUTC.getTime();
}
function oldCenterLocalToInstant(dateStr: string, hhmm: string): Date {
  const naive = Date.parse(`${dateStr}T${hhmm}:00Z`);
  if (Number.isNaN(naive)) throw new Error("Data no vàlida.");
  const offset = oldCenterOffsetMs(new Date(naive));
  const first = new Date(naive - offset);
  const refined = oldCenterOffsetMs(first);
  return refined === offset ? first : new Date(naive - refined);
}
function oldDatetimeLocalToInstant(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  if (!m) return null;
  try {
    const at = oldCenterLocalToInstant(m[1], m[2]);
    return Number.isNaN(at.getTime()) ? null : at;
  } catch {
    return null;
  }
}
// ────────────────────────────────────────────────────────────────────────────

let fallides = 0;
const fails: string[] = [];
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
const note = (msg: string) => {
  if (fails.length < 10) fails.push(msg);
};
const same = (a: Date | null, b: Date | null) =>
  a === null || b === null ? a === b : a.getTime() === b.getTime() || (Number.isNaN(a.getTime()) && Number.isNaN(b.getTime()));

console.log(`Zona del procés: ${process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone} · zona del centre: ${CENTER_TZ}`);

// Els dies de l'any 2026, més els dos canvis d'hora del 2027.
const days: string[] = [];
for (let d = Date.UTC(2026, 0, 1); d < Date.UTC(2027, 0, 1); d += 86_400_000)
  days.push(new Date(d).toISOString().slice(0, 10));
days.push("2027-03-28", "2027-10-31");
const minutes: string[] = [];
for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) minutes.push(`${pad(h)}:${pad(m)}`);

// Amb el procés en UTC (com a Vercel), el codi d'abans és la referència: ha de
// donar el mateix. En una altra zona NO ho és: llegia el text de
// `toLocaleString` amb `new Date(text)`, que l'interpreta a la zona del PROCÉS,
// i el dia que AQUELLA zona canvia d'hora s'equivocava (trobat amb
// America/New_York el 8/3/2026). Per això el que mana a tot arreu és una
// referència independent: el resultat, escrit en hora de Madrid amb un
// formatador propi, ha de ser exactament la data i l'hora demanades. L'única
// excepció és l'hora que no existeix (02:xx de l'últim diumenge de març), que
// passa a les 03:xx, com sempre.
const procUTC = (process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone) === "UTC";
const oracle = new Intl.DateTimeFormat("en-CA", { timeZone: CENTER_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const wall = (d: Date) => {
  const p = Object.fromEntries(oracle.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};
const GAP_DAYS = new Set(["2026-03-29", "2027-03-28"]);
// Cada minut amb el procés en UTC; a les altres zones, cada mitja hora (prou
// per veure-hi el canvi d'hora, i la prova no triga deu minuts).
const STEP = procUTC ? 1 : 30;
console.log(`\ncenterLocalToInstant, cada ${STEP === 1 ? "minut" : "mitja hora"} de rellotge`);
let n = 0, diff = 0, wrong = 0, oldWrong = 0;
const t0 = performance.now();
for (const day of days)
  for (const hhmm of minutes.filter((_, i) => i % STEP === 0)) {
    n++;
    const a = oldCenterLocalToInstant(day, hhmm);
    const b = now.centerLocalToInstant(day, hhmm);
    const want = GAP_DAYS.has(day) && hhmm.startsWith("02:") ? `${day} 03:${hhmm.slice(3)}` : `${day} ${hhmm}`;
    if (wall(b) !== want) {
      wrong++;
      note(`${day} ${hhmm}: ara ${b.toISOString()} = ${wall(b)} a Madrid`);
    }
    if (wall(a) !== want) oldWrong++;
    if (procUTC && !same(a, b)) {
      diff++;
      note(`${day} ${hhmm}: abans ${a.toISOString()}, ara ${b.toISOString()}`);
    }
  }
check(wrong === 0, `${n.toLocaleString("ca")} hores (${days.length} dies): ${wrong} que no tornen l'hora demanada a Madrid`);
if (procUTC) check(diff === 0, `amb el procés en UTC, com a Vercel: ${diff} diferents del codi d'abans`);
else console.log(`    (informatiu: el codi d'abans, en aquesta zona del procés, n'hauria donat ${oldWrong} de malament)`);
console.log(`    (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

// Els dies de canvi d'hora que hi ha passat, perquè consti que hi són.
const dst = days.filter(
  (d) => oldCenterOffsetMs(new Date(`${d}T00:00:00Z`)) !== oldCenterOffsetMs(new Date(`${d}T23:59:00Z`)),
);
check(dst.length === 4, `hi ha passat pels 4 dies de canvi d'hora: ${dst.join(", ")}`);
// Valors fixos (els que donen el codi d'abans i el d'ara amb el procés en UTC,
// com a Vercel): valen a qualsevol zona del procés.
for (const [day, hhmm, iso, what] of [
  ["2026-03-29", "02:30", "2026-03-29T01:30:00.000Z", "l'hora que no existeix"],
  ["2026-10-25", "02:30", "2026-10-25T01:30:00.000Z", "l'hora que passa dues vegades (la segona, en hora d'hivern)"],
  ["2026-10-25", "00:00", "2026-10-24T22:00:00.000Z", "la mitjanit del dia de l'octubre"],
  ["2026-03-29", "00:00", "2026-03-28T23:00:00.000Z", "la mitjanit del dia del març"],
  ["2026-12-31", "23:59", "2026-12-31T22:59:00.000Z", "l'últim minut de l'any"],
] as const)
  check(now.centerLocalToInstant(day, hhmm).toISOString() === iso, `${what} (${day} ${hhmm}) → ${iso}`);

console.log("\nDe l'instant a l'hora del centre, cada minut de l'any");
n = 0;
diff = 0;
const t1 = performance.now();
for (let t = Date.UTC(2025, 11, 31, 20); t < Date.UTC(2027, 0, 1, 4); t += STEP * 60_000) {
  n++;
  const d = new Date(t);
  const ok =
    oldToCenterLocal(d).getTime() === now.toCenterLocal(d).getTime() &&
    oldCenterDateStr(d) === now.centerDateStr(d) &&
    oldCenterHour(d) === now.centerHour(d) &&
    oldCenterSlot(d) === now.centerSlot(d) &&
    oldCenterWeekday(d) === now.centerWeekday(d);
  if (!ok) {
    diff++;
    note(`${d.toISOString()}: abans ${oldToCenterLocal(d).toISOString()}, ara ${now.toCenterLocal(d).toISOString()}`);
  }
}
check(diff === 0, `${n.toLocaleString("ca")} instants, cada ${STEP === 1 ? "minut" : "mitja hora"} (de 31/12/2025 a 01/01/2027, amb les mitjanits): ${diff} diferents del codi d'abans`);
console.log(`    (${((performance.now() - t1) / 1000).toFixed(1)} s)`);

console.log("\ndatetimeLocalToInstant");
const inputs = [
  "2026-10-08T09:00", " 2026-10-08T09:00 ", "2026-03-29T02:30", "2026-10-25T02:30", "2026-10-25T23:59",
  "2026-01-01T00:00", "2026-12-31T23:59", "2026-10-08T24:00", "2026-02-31T10:00", "2026-13-01T10:00",
  "2026-10-08", "", "hola", "2026-10-08T9:00", "2026-10-08T09:00:30",
];
// En UTC, contra el codi d'abans; a qualsevol zona, ha de ser exactament el
// que dona `centerLocalToInstant` (ja comprovat contra la referència).
const viaParts = (v: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v.trim());
  if (!m) return null;
  try { const d = now.centerLocalToInstant(m[1], m[2]); return Number.isNaN(d.getTime()) ? null : d; } catch { return null; }
};
const bad = inputs.filter((v) => !same(procUTC ? oldDatetimeLocalToInstant(v) : viaParts(v), now.datetimeLocalToInstant(v)));
check(bad.length === 0, `${inputs.length} entrades, bones i dolentes: ${bad.length ? bad.join(" · ") : "el que toca"}`);
// Entrades directes de `centerLocalToInstant` que no són una data neta. El
// `Date.parse` de V8 és permissiu («noTés:00Z» li dona l'1/1/2000), així que el
// codi d'abans tampoc no les rebutjava totes: el que es comprova és que les
// dues versions fan el MATEIX (o llancen totes dues, o tornen el mateix).
const run = (f: () => Date) => { try { return f().getTime(); } catch (e) { return `llança: ${(e as Error).message}`; } };
const odd: [string, string][] = [["no", "és"], ["", ""], ["2026-10-08", "24:00"], ["2026-10-08", "9:00"], ["2026-02-31", "10:00"], ["2026-13-01", "10:00"], ["2026-10-08", "10:00:30"], ["2026-10-08", "99:99"]];
const oddBad = odd.filter(([d, h]) => run(() => oldCenterLocalToInstant(d, h)) !== run(() => now.centerLocalToInstant(d, h)));
check(oddBad.length === 0, `${odd.length} entrades estranyes a centerLocalToInstant: ${oddBad.length ? oddBad.map((x) => x.join(" ")).join(" · ") : "el mateix que abans"}`);
check(run(() => now.centerLocalToInstant("2026-10-08", "99:99")) === "llança: Data no vàlida.", "una hora impossible segueix llançant «Data no vàlida.»");

console.log("\nLa memòria del dia");
const first = now.centerLocalToInstant("2026-07-15", "10:30").getTime();
check(now.centerLocalToInstant("2026-07-15", "10:30").getTime() === first, "dues vegades la mateixa conversió, el mateix instant");

console.log("\nVelocitat (la tira de 21 dies de /client/reservas: 21 × 28 mitges hores)");
// Dies del 2028, que la memòria del dia encara no ha vist: és la primera
// pintada, com quan s'hidrata la pàgina.
const strip = Array.from({ length: 21 }, (_, i) => new Date(Date.UTC(2028, 9, 9 + i)).toISOString().slice(0, 10));
const halfHours = minutes.filter((m) => m.endsWith(":00") || m.endsWith(":30")).slice(14, 42);
let t = performance.now();
for (const d of strip) for (const h of halfHours) oldCenterLocalToInstant(d, h);
const tOld = performance.now() - t;
t = performance.now();
for (const d of strip) for (const h of halfHours) now.centerLocalToInstant(d, h);
const tNew = performance.now() - t;
console.log(`    abans ${tOld.toFixed(1)} ms · ara ${tNew.toFixed(1)} ms`);

if (fails.length) console.log("\nPrimeres diferències:\n  " + fails.join("\n  "));
console.log(fallides ? `\n${fallides} fallades.` : "\nTot correcte.");
process.exit(fallides ? 1 : 0);
