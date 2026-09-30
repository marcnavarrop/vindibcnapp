/**
 * Comprova la llista de clients per pàgines, amb la cerca i els filtres fets
 * al servidor (`listClientsPage`), en simulació:
 *
 *   npm run clients:check
 *
 *   · Les pàgines recorren TOTS els clients per ordre alfabètic, sense repetir
 *     ni saltar-ne cap, i el total és el de tots.
 *   · La cerca: paraules del nom sense accents i en qualsevol ordre, un tros
 *     del correu, i els dígits del telèfon tant si està desat amb espais com
 *     pelat. Només dades del client: «Laia» no torna els clients de la Laia.
 *   · El filtre per professional, i que la cerca s'hi combina.
 *   · Un cursor manipulat es rebutja.
 *
 * La consulta real (PostgREST) es va provar a banda, llegint a producció.
 * Treballa sobre el fitxer de la simulació i el deixa tal com era.
 */
process.env.NEXT_PUBLIC_USE_MOCK = "true";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STORE = path.join(os.tmpdir(), "vindibcn-mock.json");
const abans = fs.existsSync(STORE) ? fs.readFileSync(STORE, "utf8") : null;
const restaura = () => {
  if (abans === null) fs.rmSync(STORE, { force: true });
  else fs.writeFileSync(STORE, abans);
};

const { getStore, saveStore } = await import("../lib/mock/store");
const { listClientsPage, CLIENTS_PAGE_SIZE } = await import("../lib/data/clients");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
async function all(opts: { q?: string; trainerId?: string | null }) {
  const out: { id: string; fullName: string }[] = [];
  let cursor: string | null = null;
  let total: number | null = null;
  for (let i = 0; i < 20; i++) {
    const p: Awaited<ReturnType<typeof listClientsPage>> = await listClientsPage({ ...opts, cursor });
    if (i === 0) total = p.total;
    out.push(...p.items);
    cursor = p.nextCursor;
    if (!cursor) break;
  }
  return { out, total };
}

try {
  const s = getStore();
  const NOW = "2026-01-01T00:00:00.000Z";
  for (let i = 0; i < 120; i++) {
    const pid = `cc-u-${i}`;
    const name = i === 119 ? "Òscar Últim" : `Client ${String(i).padStart(3, "0")}`;
    s.profiles.push({ id: pid, full_name: name, email: `cc${i}@exemple.cat`, phone: i === 7 ? "+34 611 222 333" : i === 8 ? "622333444" : null, role: "client", specialty: null, preferred_language: "ca", birth_date: null, height_cm: null, weight_kg: null, gender: null, emergency_contact: null, objective: null, avatar_path: null, created_at: NOW } as never);
    s.clients.push({ id: `cc-c-${i}`, profile_id: pid, assigned_trainer_id: i % 2 ? "u-trainer-laia" : null, clinical_notes: null, general_notes: null, referral_code: null, referred_by_client_id: null, created_at: i === 119 ? new Date().toISOString() : NOW } as never);
  }
  saveStore(s);
  const totals = getStore().clients.length;

  console.log("\nPàgines");
  const { out, total } = await all({});
  check(total === totals && out.length === totals, `${Math.ceil(totals / CLIENTS_PAGE_SIZE)} pàgines: ${out.length} de ${totals}, total ${total}`);
  check(new Set(out.map((c) => c.id)).size === out.length, "cap client repetit");
  const noms = out.map((c) => c.fullName);
  check(noms.every((n, i) => i === 0 || noms[i - 1] <= n), "per ordre alfabètic");
  check(out.some((c) => c.id === "cc-c-119"), "el client més nou hi és (abans, el primer a caure al tall)");

  console.log("\nCerca");
  // Es compara amb el que hi ha de debò a la simulació (hi pot haver altres
  // dades de prova), calculat aquí per un camí independent.
  const st = getStore();
  const people = st.clients.map((c) => {
    const p = st.profiles.find((x) => x.id === c.profile_id)!;
    return { id: c.id, name: p.full_name ?? "", email: p.email ?? "", phone: p.phone ?? "" };
  });
  const fold = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const same = (a: string[], b: string[]) => a.slice().sort().join() === b.slice().sort().join();
  const find = async (q: string) => (await all({ q })).out.map((c) => c.id);
  const byName = (words: string[]) => people.filter((p) => words.every((w) => fold(p.name).includes(w))).map((p) => p.id);
  const r1 = await find("oscar ultim");
  check(r1.includes("cc-c-119") && same(r1, byName(["oscar", "ultim"])), `«oscar ultim» (sense accents) → ${r1.length} Òscar Últim, el nou inclòs`);
  check(same(await find("ultim oscar"), r1), "en qualsevol ordre, el mateix");
  const r3 = await find("cc42@");
  check(same(r3, people.filter((p) => p.email.includes("cc42@")).map((p) => p.id)), `un tros del correu: ${r3.join()} (i res pel «42» dels telèfons)`);
  check((await find("611 222")).join() === "cc-c-7", "telèfon desat amb espais, cercat amb espais");
  check((await find("622333")).join() === "cc-c-8", "telèfon desat pelat");
  check((await find("61")).length === people.filter((p) => fold(p.name).includes("61") || p.email.includes("61")).length, "dues xifres: no es busquen al telèfon");
  check((await find("laia")).length === 0, "«laia» no torna els clients de la Laia");
  check((await find("(a,b)\"\\")).length === 0, "caràcters especials: cap resultat, cap error");

  console.log("\nFiltre per professional");
  const laia = await all({ trainerId: "u-trainer-laia" });
  const esperats = getStore().clients.filter((c) => c.assigned_trainer_id === "u-trainer-laia").length;
  check(laia.total === esperats && laia.out.length === esperats, `Laia: ${laia.out.length} de ${esperats}`);
  const laiaQ = await all({ trainerId: "u-trainer-laia", q: "client 00" });
  const deLaia = new Set(getStore().clients.filter((c) => c.assigned_trainer_id === "u-trainer-laia").map((c) => c.id));
  check(laiaQ.out.length > 0 && laiaQ.out.every((c) => deLaia.has(c.id)), `amb cerca: només els de la Laia (${laiaQ.out.length})`);

  console.log("\nCursor manipulat");
  let rebutjat = false;
  try { await listClientsPage({ cursor: Buffer.from(JSON.stringify(["x", "a),id.gt.(b"])).toString("base64url") }); } catch { rebutjat = true; }
  check(rebutjat, "un id amb parèntesis i comes es rebutja");
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
