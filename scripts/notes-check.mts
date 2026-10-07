/**
 * La nota ràpida de la fitxa: afegeix una línia a les notes GENERALS i no
 * trepitja mai res.
 *
 *   npm run notes:check
 *
 * Prova la branca REAL d'`appendGeneralNote` (la de Supabase, no la de la
 * simulació) contra un Supabase de memòria (`scripts/shims/fake-supabase.ts`):
 * no toca cap base. Els casos:
 *
 *   · sense notes (NULL a la base) → la línia sola;
 *   · amb notes → la línia a sota, i les d'abans intactes;
 *   · les clíniques no es toquen mai;
 *   · algú desa les notes entre la lectura i l'escriptura → es torna a llegir i
 *     la nota va a sota de la versió NOVA (no es perd cap de les dues);
 *   · si les notes canvien cada vegada → error clar i cap escriptura a cegues;
 *   · amb unes notes molt llargues (més de 2000 caràcters), es desa igualment:
 *     la comprovació no hi va, perquè no cabria a l'adreça;
 *   · un client que no existeix → error.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
delete process.env.NEXT_PUBLIC_USE_MOCK;

type Row = Record<string, unknown>;
const fake = {
  tables: {} as Record<string, Row[]>,
  hooks: {} as { beforeUpdate?: (t: string, rows: Row[]) => void; canUpdate?: (t: string, r: Row) => boolean },
  writes: [] as { table: string; op: string; via: string }[],
};
(globalThis as { __fakeDb?: unknown }).__fakeDb = fake;

const { USE_MOCK } = await import("../lib/config");
const { appendGeneralNote } = await import("../lib/data/clients");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
const CLINICAL = "Lesió prèvia de genoll.";
const reset = (general: string | null) => {
  fake.tables = { clients: [{ id: "c-1", general_notes: general, clinical_notes: CLINICAL }] };
  fake.hooks = {};
  fake.writes = [];
};
const row = () => fake.tables.clients[0];
const L1 = "08/10/2026 · Marc · Truca dimarts";
const L2 = "08/10/2026 · Raul · Porta l'informe";

check(!USE_MOCK, "branca real (no la simulació)");

console.log("\nSense notes");
reset(null);
await appendGeneralNote("c-1", L1);
check(row().general_notes === L1, "NULL → la línia sola");
check(row().clinical_notes === CLINICAL, "les clíniques, intactes");

console.log("\nAmb notes");
reset("Prefereix horari de matí.  \n");
await appendGeneralNote("c-1", L1);
check(row().general_notes === `Prefereix horari de matí.\n${L1}`, "la línia a sota, sense espais de més al final de l'anterior");
await appendGeneralNote("c-1", L2);
check(row().general_notes === `Prefereix horari de matí.\n${L1}\n${L2}`, "una segona, a sota de la primera");
check(row().clinical_notes === CLINICAL, "les clíniques, intactes");
check(fake.writes.every((w) => w.via === "session"), "escriu amb la sessió (passa per la RLS), no amb la clau de servei");

console.log("\nAlgú desa alhora");
reset("A");
let once = true;
fake.hooks.beforeUpdate = (t, rows) => {
  if (t === "clients" && once) {
    once = false;
    rows[0].general_notes = `A\n${L2}`; // l'altra persona guanya per poc
  }
};
await appendGeneralNote("c-1", L1);
check(row().general_notes === `A\n${L2}\n${L1}`, "es torna a llegir: hi són les dues notes");

console.log("\nCanvien cada vegada");
reset("A");
let n = 0;
fake.hooks.beforeUpdate = (t, rows) => {
  if (t === "clients") rows[0].general_notes = `A${++n}`;
};
let err = "";
try {
  await appendGeneralNote("c-1", L1);
} catch (e) {
  err = e instanceof Error ? e.message : String(e);
}
check(/Torna-ho a provar/.test(err), `error clar («${err}»)`);
check(!String(row().general_notes).includes(L1), "no s'ha escrit a cegues");

console.log("\nNotes molt llargues");
reset("x".repeat(2500));
fake.hooks.beforeUpdate = () => {};
await appendGeneralNote("c-1", L1);
check(String(row().general_notes).endsWith(`\n${L1}`) && String(row().general_notes).length === 2500 + 1 + L1.length, "es desa (sense el text sencer com a filtre)");

console.log("\nClient inexistent");
reset(null);
err = "";
try {
  await appendGeneralNote("c-x", L1);
} catch (e) {
  err = e instanceof Error ? e.message : String(e);
}
check(err === "Client no trobat.", "error «Client no trobat.»");

console.log(fallides ? `\n${fallides} fallades.` : "\nTot correcte.");
process.exit(fallides ? 1 : 0);
