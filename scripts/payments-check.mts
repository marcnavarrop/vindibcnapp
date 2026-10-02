/**
 * Comprova la llista de pagaments per pàgines i els totals, en simulació:
 *
 *   npm run payments:check
 *
 *   · El cursor recorre TOTS els pagaments, del més nou al més antic, sense
 *     repetir ni saltar-ne cap, també quan n'hi ha molts al mateix instant.
 *   · Un cursor manipulat es rebutja (no arriba mai al filtre de la base).
 *   · `getPaymentsSummary` suma el mateix que la llista sencera, amb el
 *     desglossament per mètode.
 *   · `paymentsByMonth` talla en hora de Madrid i posa a zero els mesos buits.
 *   · «Nou pagament»: els bons d'UN client (els seus i prou, del més nou al més
 *     antic) i que un bo d'un altre client no hi passa.
 *
 * La part real (les funcions de la 0095 i el filtre de PostgREST) es va provar
 * a banda: PGlite per a la migració i una lectura a producció per al cursor.
 *
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
const {
  listPayments, getPaymentsSummary, paymentsByMonth, PAYMENTS_PAGE_SIZE,
  listBonosForPayment, bonoBelongsTo,
} = await import(
  "../lib/data/payments"
);
const { centerDateStr } = await import("../lib/center-time");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

try {
  const s = getStore();
  // 130 pagaments nous: 30 al MATEIX instant (el desempat per id ha de
  // funcionar) i la resta repartits en els últims mesos.
  const base = Date.now() - 3 * 86_400_000;
  const same = new Date(base).toISOString();
  for (let i = 0; i < 130; i++) {
    const at = i < 30 ? same : new Date(base - i * 2 * 86_400_000).toISOString();
    s.payments.push({
      id: `pc-${String(i).padStart(3, "0")}`, client_id: "c-ana", bono_id: null,
      stripe_payment_id: null, amount: 10 + (i % 7), currency: "eur",
      method: i % 3 === 0 ? "cash" : "card", concept: null, paid_at: at, created_at: at,
      // Una de cada cinc targetes, per internet (porta l'identificador de Stripe).
      ...(i % 3 !== 0 && i % 5 === 0 ? { stripe_payment_id: `pi_pc_${i}` } : {}),
    } as never);
  }
  saveStore(s);
  const totes = getStore().payments;

  console.log("\nLlista per pàgines");
  const vistos: string[] = [];
  let cursor: string | null = null;
  let pagines = 0;
  do {
    const page: Awaited<ReturnType<typeof listPayments>> = await listPayments({ cursor });
    vistos.push(...page.items.map((p) => p.id));
    cursor = page.nextCursor;
    pagines++;
  } while (cursor && pagines < 50);
  const esperat = totes
    .slice()
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.id.localeCompare(a.id))
    .map((p) => p.id);
  check(vistos.length === totes.length, `${pagines} pàgines de ${PAYMENTS_PAGE_SIZE}: ${vistos.length} de ${totes.length}`);
  check(new Set(vistos).size === vistos.length, "cap pagament repetit");
  check(JSON.stringify(vistos) === JSON.stringify(esperat), "del més nou al més antic, desempat per id (30 al mateix instant)");
  const primera = await listPayments();
  check(primera.items.length === PAYMENTS_PAGE_SIZE && primera.nextCursor !== null, "la primera pàgina en porta 50 i diu que n'hi ha més");

  console.log("\nCursor manipulat");
  const dolent = Buffer.from(JSON.stringify(["2026-01-01T00:00:00Z", "x),id.gt.(0"])).toString("base64url");
  let rebutjat = false;
  try { await listPayments({ cursor: dolent }); } catch { rebutjat = true; }
  check(rebutjat, "un id amb parèntesis i comes es rebutja");
  rebutjat = false;
  try { await listPayments({ cursor: "no-es-base64-json" }); } catch { rebutjat = true; }
  check(rebutjat, "un cursor que no és el nostre es rebutja");

  console.log("\nTotals");
  const sum = await getPaymentsSummary();
  const round = (n: number) => Math.round(n * 100) / 100;
  const total = round(totes.reduce((a, p) => a + p.amount, 0));
  check(sum.total === total && sum.count === totes.length, `total ${sum.total} · ${sum.count} pagaments`);
  check(
    round(sum.card.total + sum.cash.total) === sum.total && sum.card.count + sum.cash.count === sum.count,
    `targeta ${sum.card.total} (${sum.card.count}) + efectiu ${sum.cash.total} (${sum.cash.count}) = total`,
  );
  {
    const tpv = totes.filter((p) => p.method === "card" && !p.stripe_payment_id);
    const onl = totes.filter((p) => p.method === "card" && !!p.stripe_payment_id);
    check(
      sum.cardTpv.count === tpv.length && sum.cardOnline.count === onl.length && onl.length > 0 &&
        round(sum.cardTpv.total + sum.cardOnline.total) === sum.card.total && sum.cardTpv.count + sum.cardOnline.count === sum.card.count,
      `targeta (TPV) ${sum.cardTpv.total} (${sum.cardTpv.count}) + en línia ${sum.cardOnline.total} (${sum.cardOnline.count}) = targeta`,
    );
  }

  console.log("\nPer mesos (hora de Madrid)");
  const mesos = await paymentsByMonth(12);
  check(mesos.length === 12, "12 mesos, un per fila");
  check(mesos[11].month === `${centerDateStr(new Date()).slice(0, 7)}-01`, `l'últim és el mes que corre (${mesos[11].month})`);
  const perMes = new Map<string, number>();
  for (const p of totes) {
    const k = `${centerDateStr(new Date(p.paid_at)).slice(0, 7)}-01`;
    perMes.set(k, round((perMes.get(k) ?? 0) + p.amount));
  }
  check(mesos.every((m) => m.total === (perMes.get(m.month) ?? 0)), "cada mes suma el mateix que la llista, i els buits són zero");
  let foraDeRang = 0;
  for (const n of [0, 37, 1.5]) {
    try { await paymentsByMonth(n); } catch { foraDeRang++; }
  }
  check(foraDeRang === 3, "0, 37 i 1,5 mesos es rebutgen abans d'arribar a la base");

  console.log("\n«Nou pagament»: els bons del client triat");
  const deAna = await listBonosForPayment("c-ana");
  const esperats = getStore().bonos.filter((b) => b.client_id === "c-ana");
  check(deAna.length === esperats.length && deAna.length > 0, `c-ana: ${deAna.length} bons, tots seus`);
  check(!deAna.some((b) => !esperats.some((e) => e.id === b.id)), "cap bo d'un altre client");
  const unAltre = getStore().bonos.find((b) => b.client_id !== "c-ana")!;
  check(await bonoBelongsTo(esperats[0].id, "c-ana"), "un bo seu: sí");
  check(!(await bonoBelongsTo(unAltre.id, "c-ana")), `el bo ${unAltre.id} d'un altre client: no`);
  check((await listBonosForPayment("no-existeix")).length === 0, "un client que no existeix: cap bo");

} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
