/**
 * Els tests d'avaluació (0113): crear, editar, ordenar i esborrar tests i
 * registres, la diferència amb l'anterior i la gràfica, en simulació.
 *
 *   npm run tests:check
 *
 * Treballa amb un fitxer de simulació PROPI en una carpeta temporal nova (no
 * toca el de `npm run dev`) i prova la capa de dades (`lib/data/client-tests`)
 * i les regles pures (`lib/client-tests`):
 *
 *   · un fitxer d'abans de la 0113 (sense les col·leccions) es llegeix bé;
 *   · crear tests: al final, títol únic per client sense mirar majúscules ni
 *     espais (un altre client sí que el pot repetir), editar, reordenar;
 *   · registres: ordre cronològic, data futura rebutjada, editar, treure;
 *   · ESBORRAR UN TEST S'EMPORTA ELS SEUS REGISTRES, i res més;
 *   · suggeriments: títol i unitat, comptats, sense client ni valors;
 *   · la diferència i el seu color (puja, baixa, neutre) i la gràfica;
 *   · la lectura dels valors escrits a mà («12,5», «1.234,5»);
 *   · crear tests i registres demana el consentiment de salut (0117); editar i
 *     esborrar el que hi ha, no.
 *
 * Les regles de QUI pot fer-ho són de la RLS (0113) i es proven al SQL Editor
 * (`supabase/tests/0113_client_tests_rls.sql`).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.NEXT_PUBLIC_USE_MOCK = "true";
process.env.TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "vindi-tests-"));
const STORE = path.join(os.tmpdir(), "vindibcn-mock.json");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
async function code(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "error";
  }
}

const { getStore, saveStore } = await import("../lib/mock/store");
const data = await import("../lib/data/client-tests");
const rules = await import("../lib/client-tests");
const { centerToday } = await import("../lib/center-time");

check(os.tmpdir() !== "/tmp" && !fs.existsSync(STORE), "fitxer de simulació propi, encara buit");

// Un fitxer «d'abans»: sense les col·leccions de la 0113.
{
  const s = getStore() as unknown as Record<string, unknown>;
  delete s.client_tests;
  delete s.client_test_entries;
  saveStore(s as unknown as ReturnType<typeof getStore>);
}
const ANA = "c-ana";
const MARTA = "c-marta";
const LAIA = "u-trainer-laia";
const today = centerToday();
const v = (title: string, unit: string | null = null, betterWhen: "up" | "down" | "neutral" = "neutral") => ({
  title,
  unit,
  description: null,
  betterWhen,
});

console.log("\nUn fitxer d'abans de la 0113");
let tests = await data.listClientTests(ANA);
check(tests.length === 1 && tests[0].title === "Dominades" && tests[0].entries.length === 3, "es reomplen de la llavor: «Dominades» amb 3 registres");
check(tests[0].entries.map((e) => e.value).join() === "3,5,7", "…en ordre cronològic");

console.log("\nTests");
const t2 = await data.createClientTest(ANA, v("Perímetre abdominal", "cm", "down"), LAIA);
const t3 = await data.createClientTest(ANA, v("Salt vertical", "cm", "up"), LAIA);
tests = await data.listClientTests(ANA);
check(tests.map((t) => t.title).join() === "Dominades,Perímetre abdominal,Salt vertical", "un test nou va al final");
check((await code(() => data.createClientTest(ANA, v("  DOMINADES "), LAIA))) === "23505", "títol repetit (majúscules i espais): 23505");

console.log("\nConsentiment de salut (0117)");
check(await data.canCreateClientTests(ANA), "l'Ana té el consentiment de salut (llavor): pot tenir tests nous");
check(!(await data.canCreateClientTests(MARTA)), "la Marta no el té");
check((await code(() => data.createClientTest(MARTA, v("Dominades", "reps"), LAIA))) === "42501", "sense consentiment, crear un test: 42501");
{
  // Un test de la Marta d'abans (com si fos anterior a la 0117), posat a mà.
  const s = getStore();
  const now = new Date().toISOString();
  s.client_tests.push({ id: "ct-marta-vell", client_id: MARTA, title: "Salt", unit: "cm", description: null, better_when: "up", position: 1, created_by: LAIA, created_at: now, updated_at: now });
  saveStore(s);
}
check((await code(() => data.addTestEntry("ct-marta-vell", { measuredOn: today, value: 30, notes: null }, LAIA))) === "42501", "…ni un registre en un test que ja hi era");
check((await code(() => data.updateClientTest("ct-marta-vell", v("Salt CMJ", "cm", "up")))) === null, "…però editar el que hi ha, sí");
check((await code(() => data.deleteClientTest("ct-marta-vell"))) === null, "…i esborrar-lo, també");
{
  // La Marta signa el consentiment.
  const s = getStore();
  s.consents.push({ id: "cons-marta-health", user_id: "u-client-marta", type: "health_data", version: "2026-06", granted_at: new Date().toISOString(), ip: null, created_at: new Date().toISOString() });
  saveStore(s);
}
check(await data.canCreateClientTests(MARTA), "quan el signa, ja pot");
check((await code(() => data.createClientTest(MARTA, v("Dominades", "reps"), LAIA))) === null, "un altre client (amb consentiment) sí que pot tenir «Dominades»");
await data.updateClientTest(t3, { title: "Salt CMJ", unit: "cm", description: "Contramoviment, mans a la cintura.", betterWhen: "up" });
tests = await data.listClientTests(ANA);
check(tests[2].title === "Salt CMJ" && tests[2].description?.startsWith("Contramoviment") === true, "editar títol i descripció");
check((await code(() => data.updateClientTest(t3, v("Perímetre abdominal")))) === "23505", "editar-lo cap a un títol que ja té: 23505");
await data.reorderClientTests(ANA, [t3, tests[0].id, t2]);
tests = await data.listClientTests(ANA);
check(tests.map((t) => t.title).join() === "Salt CMJ,Dominades,Perímetre abdominal", "reordenar");
check((await code(() => data.reorderClientTests(ANA, [t3, t2]))) === "22023", "reordenar amb una llista incompleta: 22023");

console.log("\nRegistres");
await data.addTestEntry(t2, { measuredOn: "2026-09-01", value: 92.5, notes: null }, LAIA);
await data.addTestEntry(t2, { measuredOn: "2026-08-01", value: 95, notes: "Primera presa" }, LAIA);
await data.addTestEntry(t2, { measuredOn: "2026-10-01", value: 91, notes: null }, LAIA);
let peri = (await data.listClientTests(ANA)).find((t) => t.id === t2)!;
check(peri.entries.map((e) => e.value).join() === "95,92.5,91", "s'ordenen per data, no per quan es van entrar");
check(
  (await code(() => data.addTestEntry(t2, { measuredOn: "2999-01-01", value: 1, notes: null }, LAIA))) === "23514",
  "data futura: 23514",
);
const mid = peri.entries[1].id;
await data.updateTestEntry(mid, { measuredOn: "2026-09-01", value: 93, notes: "Corregit" });
peri = (await data.listClientTests(ANA)).find((t) => t.id === t2)!;
check(peri.entries[1].value === 93 && peri.entries[1].notes === "Corregit", "editar un registre");
await data.deleteTestEntry(mid);
peri = (await data.listClientTests(ANA)).find((t) => t.id === t2)!;
check(peri.entries.length === 2, "treure un registre");
check((await code(() => data.deleteTestEntry(mid))) === "P0002", "treure'l dos cops: P0002");

console.log("\nEsborrar un test s'emporta els seus registres, i res més");
const before = getStore().client_test_entries.length;
await data.deleteClientTest(t2);
tests = await data.listClientTests(ANA);
check(!tests.some((t) => t.id === t2), "el test ja no hi és");
check(getStore().client_test_entries.length === before - 2 && !getStore().client_test_entries.some((e) => e.test_id === t2), "…ni els seus 2 registres");
check(tests.find((t) => t.title === "Dominades")!.entries.length === 3, "…i els dels altres tests es queden");

console.log("\nSuggeriments");
const sug = await data.listTestSuggestions();
const dom = sug.find((s) => s.title === "Dominades");
check(dom?.uses === 2 && dom.unit === "reps", "«Dominades · reps» comptat 2 cops (Ana i Marta)");
check(sug.every((s) => Object.keys(s).sort().join() === "title,unit,uses"), "només títol, unitat i usos: cap client ni valor");

console.log("\nLa diferència amb l'anterior");
check(rules.trendOf([5], "up") === null, "un sol registre: sense diferència");
check(JSON.stringify(rules.trendOf([5, 7], "up")) === '{"diff":2,"tone":"good"}', "millor si puja i puja: verd");
check(rules.trendOf([5, 7], "down")?.tone === "bad", "millor si baixa i puja: vermell");
check(rules.trendOf([95, 92.5], "down")?.tone === "good" && rules.trendOf([95, 92.5], "down")?.diff === -2.5, "millor si baixa i baixa: verd, −2,5");
check(rules.trendOf([5, 7], "neutral")?.tone === "same" && rules.trendOf([5, 5], "up")?.tone === "same", "neutre, o igual: gris");
check(rules.trendOf([0.1, 0.3], "up")?.diff === 0.2, "sense soroll de coma flotant (0,1 → 0,3 = 0,2)");
check(rules.formatDiff(-2.5, "ca") === "−2,5" && rules.formatDiff(2, "en") === "+2" && rules.formatDiff(0, "es") === "0", "«−2,5», «+2», «0»");
check(rules.formatValue(12.5, "ca") === "12,5" && rules.formatValue(12.5, "en") === "12.5" && rules.formatValue(7, "es") === "7", "12,5 en català, 12.5 en anglès");

console.log("\nLa gràfica");
const g = rules.chartGeometry([
  { measuredOn: "2026-01-01", value: 10 },
  { measuredOn: "2026-01-02", value: 20 },
  { measuredOn: "2026-01-11", value: 15 },
])!;
const { w, h, padX, padTop, padBottom } = rules.CHART;
check(g.points[0].x === padX && g.points[2].x === w - padX, "la primera a l'esquerra, la darrera a la dreta");
check(Math.abs(g.points[1].x - (padX + (w - 2 * padX) / 10)) < 0.01, "l'eix X és el temps: 1 dia de 10 = una desena part");
check(g.points[1].y < g.points[2].y && g.points[2].y < g.points[0].y, "més valor, més amunt");
check(g.points.every((p) => p.y > padTop && p.y < h - padBottom), "amb marge: cap punt toca la vora");
check(g.max === 20 && g.min === 10 && g.yMax === g.points[1].y && g.yMin === g.points[0].y, "els rètols són el màxim i el mínim de debò, a la seva altura");
const one = rules.chartGeometry([{ measuredOn: "2026-01-01", value: 5 }])!;
check(one.points[0].x === w / 2 && one.points[0].y === h / 2, "un sol registre: al mig");
const flat = rules.chartGeometry([
  { measuredOn: "2026-01-01", value: 0 },
  { measuredOn: "2026-01-05", value: 0 },
])!;
check(flat.points.every((p) => p.y === h / 2), "tots iguals (fins i tot 0): la línia al mig, sense dividir per zero");
const sameDay = rules.chartGeometry([
  { measuredOn: "2026-01-01", value: 1 },
  { measuredOn: "2026-01-01", value: 2 },
])!;
check(sameDay.points[0].x === padX && sameDay.points[1].x === w - padX, "tots del mateix dia: en ordre");
check(rules.chartGeometry([]) === null, "sense registres: sense gràfica");

console.log("\nValors escrits a mà");
const pv = rules.parseValue;
check(pv("12") === 12 && pv("12,5") === 12.5 && pv("12.5") === 12.5 && pv(" -3 ") === -3, "«12», «12,5», «12.5», «-3»");
check(pv("1.234,5") === 1234.5 && pv("1,234.5") === 1234.5, "amb separador de milers, en els dos estils");
check(pv("0,0004") === 0 && pv("2,0005") === 2.001, "arrodonit a 3 decimals");
check(pv("") === null && pv("abc") === null && pv("12 cm") === null && pv("1e3") === null, "buit o text: no és un valor");
check(pv("1000000000") === null, "fora de numeric(12,3): rebutjat");

console.log("\nFormularis");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(o)) f.set(k, val);
  return f;
};
const okT = rules.parseTest(fd({ title: "  Perímetre   abdominal ", unit: " cm ", betterWhen: "down", description: " " }));
check(okT.ok && okT.value.title === "Perímetre abdominal" && okT.value.unit === "cm" && okT.value.description === null && okT.value.betterWhen === "down", "test: espais netejats, descripció buida = cap");
check(!rules.parseTest(fd({ title: "  " })).ok && !rules.parseTest(fd({ title: "x".repeat(61) })).ok, "títol buit o > 60: rebutjat");
check(rules.parseTest(fd({ title: "X", betterWhen: "sideways" })).ok && (rules.parseTest(fd({ title: "X", betterWhen: "sideways" })) as { value: { betterWhen: string } }).value.betterWhen === "neutral", "un sentit desconegut queda neutre");
const okE = rules.parseEntry(fd({ value: "12,5", notes: " " }), today);
check(okE.ok && okE.value.measuredOn === today && okE.value.value === 12.5 && okE.value.notes === null, "registre: sense data = avui");
check(!rules.parseEntry(fd({ value: "1", measuredOn: "2999-01-01" }), today).ok, "registre amb data futura: rebutjat");
check(!rules.parseEntry(fd({ value: "1", measuredOn: "2026-02-30x" }), today).ok && !rules.parseEntry(fd({ value: "" }), today).ok, "data no vàlida o sense valor: rebutjat");

fs.rmSync(process.env.TMPDIR!, { recursive: true, force: true });
console.log(fallides ? `\n${fallides} comprovacions fallides` : "\nTot correcte");
process.exit(fallides ? 1 : 0);
