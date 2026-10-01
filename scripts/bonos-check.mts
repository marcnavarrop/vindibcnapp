/**
 * Comprova la llista de bons per pàgines, els comptadors i el «Pendent de
 * cobrament» d'Inici, en simulació:
 *
 *   npm run bonos:check
 *
 *   · Les pàgines recorren TOTS els bons, del més nou al més antic, sense
 *     repetir ni saltar-ne cap, també amb molts creats al mateix instant.
 *   · Els filtres (estat, servei, «Els meus», nom del client) es fan al
 *     servidor i es combinen.
 *   · Els comptadors dels filtres sumen la piloteta, i el «Pendent de
 *     cobrament» d'Inici és la MATEIXA cua: pendents no caducats i decaiguts
 *     (també un decaigut amb data passada, que no caduca).
 *   · Un cursor manipulat es rebutja.
 *
 * La consulta real i la funció de la 0097 es van provar a banda (lectura a
 * producció i PGlite). Treballa sobre el fitxer de la simulació i el deixa
 * tal com era.
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
const bonos = await import("../lib/data/bonos");
const { centerToday, addDaysStr } = await import("../lib/center-time");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
type Opts = Parameters<typeof bonos.listBonosPage>[0];
async function all(opts: Opts) {
  const out: { id: string; status: string }[] = [];
  let cursor: string | null = null;
  let total: number | null = null;
  for (let i = 0; i < 30; i++) {
    const p: Awaited<ReturnType<typeof bonos.listBonosPage>> = await bonos.listBonosPage({ ...opts, cursor });
    if (i === 0) total = p.total;
    out.push(...p.items);
    cursor = p.nextCursor;
    if (!cursor) break;
  }
  return { out, total };
}

try {
  const s = getStore();
  const today = centerToday();
  const same = "2026-05-05T10:00:00.000Z";
  const statuses = ["active", "pending_payment", "unpaid", "completed", "active", "pending_payment"];
  const services = ["ep_individual", "fisioterapia", "grupo_reducido"];
  const clients = ["c-ana", "c-pau", "c-marta"];
  for (let i = 0; i < 130; i++) {
    const created = i < 25 ? same : new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString();
    s.bonos.push({
      id: `bk-${String(i).padStart(3, "0")}`, client_id: clients[i % 3], service_type: services[i % 3],
      total_sessions: 8, remaining_sessions: 4, price: 100 + i, status: statuses[i % 6],
      purchased_at: created, expires_at: null, first_reservation_at: null, gift_voucher_id: null,
      stripe_checkout_session_id: null, subscription_id: null, subscription_cycle_start: null,
      is_subscription_extra: false, stripe_invoice_id: null, service_id: null, auto_renew: false,
      renewed_from_bono_id: null, created_at: created,
    } as never);
  }
  // Els dos casos de la vora: un pendent ja caducat (NO es cobra) i un
  // decaigut amb data passada (SÍ: els decaiguts no caduquen).
  const pendCaducat = s.bonos.find((b) => b.id === "bk-001")!;
  pendCaducat.expires_at = addDaysStr(today, -2);
  const decaigutVell = s.bonos.find((b) => b.id === "bk-002")!;
  decaigutVell.expires_at = addDaysStr(today, -30);
  saveStore(s);

  console.log("\nPàgines");
  const { out, total } = await all({});
  const n = getStore().bonos.length;
  check(total === n && out.length === n, `${Math.ceil(n / bonos.BONOS_PAGE_SIZE)} pàgines: ${out.length} de ${n}, total ${total}`);
  check(new Set(out.map((b) => b.id)).size === out.length, "cap bo repetit (25 creats al mateix instant)");
  const st = getStore();
  const order = st.bonos.slice().sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).map((b) => b.id);
  check(JSON.stringify(out.map((b) => b.id)) === JSON.stringify(order), "del més nou al més antic");
  check(getStore().bonos.find((b) => b.id === "bk-001")?.status === "expired", "el pendent caducat ja consta 'expired' (l'escombrat corre abans de llistar)");

  console.log("\nFiltres al servidor");
  const pend = await all({ filter: "pending_payment" });
  check(pend.out.every((b) => b.status === "pending_payment") && pend.total === getStore().bonos.filter((b) => b.status === "pending_payment").length, `pendents: ${pend.total}`);
  const fisio = await all({ serviceType: "fisioterapia" });
  check(fisio.out.length > 0 && fisio.out.every((b) => getStore().bonos.find((x) => x.id === b.id)?.service_type === "fisioterapia"), `servei fisioteràpia: ${fisio.total}`);
  const laia = await all({ assignedTrainerId: "u-trainer-laia" });
  const deLaia = new Set(getStore().clients.filter((c) => c.assigned_trainer_id === "u-trainer-laia").map((c) => c.id));
  check(laia.out.length > 0 && laia.out.every((b) => deLaia.has(getStore().bonos.find((x) => x.id === b.id)!.client_id)), `«Els meus» de la Laia: ${laia.total}`);
  const ana = await all({ q: "ana ferrer", filter: "active", serviceType: "ep_individual" });
  check(ana.out.length > 0 && ana.out.every((b) => { const x = getStore().bonos.find((y) => y.id === b.id)!; return x.client_id === "c-ana" && x.status === "active" && x.service_type === "ep_individual"; }), `nom + estat + servei combinats: ${ana.total}`);
  check((await all({ q: "ferrer ana" })).total === (await all({ q: "ana ferrer" })).total, "el nom en qualsevol ordre");

  console.log("\nComptadors, piloteta i «Pendent de cobrament»");
  const counts = await bonos.countCollectableByStatus();
  const badge = await bonos.countCenterCollectableBonos();
  check(counts.pending_payment + counts.unpaid === badge, `comptadors ${counts.pending_payment} + ${counts.unpaid} = piloteta ${badge}`);
  const inici = await bonos.getCollectableSummary();
  const cua = getStore().bonos.filter((b) => b.status === "unpaid" || (b.status === "pending_payment" && !(b.expires_at && b.expires_at < today)));
  const imp = Math.round(cua.reduce((a, b) => a + b.price, 0) * 100) / 100;
  check(inici.count === badge && inici.count === cua.length, `Inici ${inici.count} bons = piloteta ${badge}`);
  check(inici.total === imp, `import d'Inici ${inici.total} € = suma dels preus de la cua ${imp} €`);
  check(cua.some((b) => b.id === "bk-002") && !cua.some((b) => b.id === "bk-001"), "el decaigut amb data passada hi és; el pendent caducat, no");
  {
    // Un pendent que ha caducat i que l'escombrat encara NO ha tocat (consta
    // 'pending_payment'): no s'ha de comptar ni a Inici ni a la piloteta.
    const st2 = getStore();
    const b = st2.bonos.find((x) => x.id === "bk-005")!; // pending_payment
    b.expires_at = addDaysStr(today, -1);
    saveStore(st2);
    const [i2, badge2, c2] = await Promise.all([
      bonos.getCollectableSummary(),
      bonos.countCenterCollectableBonos(),
      bonos.countCollectableByStatus(),
    ]);
    check(
      getStore().bonos.find((x) => x.id === "bk-005")?.status === "pending_payment" &&
        i2.count === inici.count - 1 && badge2 === badge - 1 && c2.pending_payment === counts.pending_payment - 1,
      `pendent caducat SENSE escombrar: Inici ${inici.count}→${i2.count}, piloteta ${badge}→${badge2}, comptador ${counts.pending_payment}→${c2.pending_payment}`,
    );
  }

  console.log("\nCursor manipulat");
  let rebutjat = false;
  try { await bonos.listBonosPage({ cursor: Buffer.from(JSON.stringify(["2026-01-01T00:00:00Z", "x),id.gt.(y"])).toString("base64url") }); } catch { rebutjat = true; }
  check(rebutjat, "un id amb parèntesis i comes es rebutja");
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
