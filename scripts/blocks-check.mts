/**
 * Comprova que els bloquejos de tots els professionals es llegeixen per
 * FINESTRA (`listAllBlocksLite(from)`) i no tot l'històric, en simulació:
 *
 *   npm run blocks:check
 *
 *   · Un bloqueig que va acabar fa mesos ja no ve.
 *   · Unes vacances futures hi són sempre, i /prova (`getPublicTrialData`) les
 *     rep per no oferir aquelles hores.
 *   · Un bloqueig d'aquesta setmana que ja ha passat ve si es mira des del
 *     dilluns (l'ocupació setmanal d'Inici el necessita).
 *
 * Abans es portaven tots, sense ordre: al tall de 1000 files en podia caure
 * qualsevol, també el de les vacances.
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
const { listAllBlocksLite } = await import("../lib/data/availability-blocks");
const { getPublicTrialData } = await import("../lib/data/trial-bookings");
const { centerDayStart, centerToday, centerWeekStart } = await import("../lib/center-time");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

try {
  const s = getStore();
  const day = 86_400_000, now = Date.now();
  const block = (id: string, from: number, to: number) => ({
    id, trainer_id: "u-trainer-laia", start_at: new Date(from).toISOString(), end_at: new Date(to).toISOString(),
    reason: "prova", created_at: new Date(now).toISOString(),
  });
  // 1200 bloquejos vells (més que el sostre de 1000) i els tres que importen.
  for (let i = 0; i < 1200; i++) s.availability_blocks.push(block(`bk-old-${i}`, now - (400 + i) * day, now - (399 + i) * day) as never);
  s.availability_blocks.push(block("bk-vacances", now + 10 * day, now + 17 * day) as never);
  s.availability_blocks.push(block("bk-avui-ja-passat", now - 3 * 3_600_000, now - 2 * 3_600_000) as never);
  saveStore(s);

  const ids = (xs: { startAt: string }[]) => xs.length;
  const fromNow = await listAllBlocksLite(new Date());
  check(fromNow.some((b) => b.startAt === new Date(now + 10 * day).toISOString()), "des d'ara: les vacances futures hi són");
  check(!fromNow.some((b) => b.endAt < new Date().toISOString()), `des d'ara: cap bloqueig ja acabat (${ids(fromNow)} en total, no 1200+)`);
  const fromMonday = await listAllBlocksLite(centerDayStart(centerWeekStart(centerToday())));
  check(fromMonday.some((b) => b.endAt === new Date(now - 2 * 3_600_000).toISOString()), "des del dilluns: el d'avui que ja ha passat hi és (ocupació setmanal)");
  check(fromMonday.every((b, i) => i === 0 || fromMonday[i - 1].startAt <= b.startAt), "per ordre d'inici");
  const pub = await getPublicTrialData();
  check(pub.blocks.some((b) => b.startAt === new Date(now + 10 * day).toISOString()), "/prova rep les vacances futures");
  check(pub.blocks.length < 10, `/prova no rep els 1200 vells (${pub.blocks.length})`);
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
