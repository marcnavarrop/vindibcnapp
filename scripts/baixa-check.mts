/**
 * La baixa d'un professional (0127, 0128), en simulació.
 *
 *   npm run baixa:check
 *
 *   1. Un professional desactivat no té disponibilitat enlloc: ni al calendari
 *      global (`listAllTrainerRulesLite`), ni a la comprovació d'una reserva
 *      (`listAvailabilityLite`), ni a /prova (`getPublicTrialData`), ni als
 *      selectors (`listTrainers`); a facturació, sí, marcat.
 *   2. No se li pot assignar cap client.
 *   3. Les esperes anul·lades per la baixa: s'avisa una sola vegada, i una
 *      d'una hora que ja ha passat es marca sense correu.
 *
 * La pantalla i el flux sencer els prova Playwright; la base, la prova SQL
 * supabase/tests/0127_0128_professional_baixa.sql. Treballa sobre el fitxer de
 * la simulació i el deixa tal com era.
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
const { listAllTrainerRulesLite, listAvailabilityLite } = await import("../lib/data/availability");
const { getPublicTrialData } = await import("../lib/data/trial-bookings");
const { listTrainers, reassignClientTrainer } = await import("../lib/data/clients");
const { notifyCancelledWaits, WAIT_CANCEL_PROFESSIONAL_GONE } = await import("../lib/data/waitlist");

let bad = 0;
const check = (nom: string, ok: boolean, detall = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${nom}${detall ? ` — ${detall}` : ""}`);
};

const LAIA = "u-trainer-laia";
const setDeactivated = (v: string | null) => {
  const s = getStore();
  s.profiles.find((p) => p.id === LAIA)!.deactivated_at = v;
  saveStore(s);
};

try {
  fs.rmSync(STORE, { force: true });

  console.log("\n1. Sense disponibilitat enlloc\n");
  const teRegles = async () => (await listAllTrainerRulesLite()).some((r) => r.trainerId === LAIA);
  const aProva = async () => (await getPublicTrialData()).rules.some((r) => r.trainerId === LAIA);
  check("activa: la Laia té franges, també a /prova", (await teRegles()) && (await aProva()) && (await listAvailabilityLite(LAIA)).length > 0);
  setDeactivated(new Date().toISOString());
  check("de baixa: cap franja al calendari", !(await teRegles()));
  check("cap franja a /prova", !(await aProva()));
  check("cap franja en comprovar una reserva", (await listAvailabilityLite(LAIA)).length === 0);
  check("fora dels selectors", !(await listTrainers()).some((t) => t.id === LAIA));
  const fact = (await listTrainers({ includeInactive: true })).find((t) => t.id === LAIA);
  check("a facturació hi és, marcada", fact?.active === false);
  check("les regles es conserven (per si es reactiva)", getStore().availability_rules.some((r) => r.trainer_id === LAIA));

  console.log("\n2. No se li pot assignar cap client\n");
  let err = "";
  try {
    await reassignClientTrainer("c-oriol", LAIA);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  check("assignar-li un client falla", /donat de baixa/.test(err), err);
  setDeactivated(null);
  check("reactivada, torna a tenir franges", await teRegles());

  console.log("\n3. Avís de les esperes anul·lades\n");
  {
    const s = getStore();
    const base = {
      bono_id: null,
      service_type: "grupo_reducido" as const,
      trainer_id: LAIA,
      series_id: null,
      status: "cancelled" as const,
      created_at: new Date().toISOString(),
      fulfilled_at: null,
      fulfilled_reservation_id: null,
      cancelled_by_center: false,
      cancel_reason: WAIT_CANCEL_PROFESSIONAL_GONE,
      cancel_notified_at: null,
    };
    s.waitlist_entries.push(
      { ...base, id: "bc-w-futura", client_id: "c-ana", desired_date: "2099-01-05", desired_time: "10:00:00" },
      { ...base, id: "bc-w-passada", client_id: "c-ana", desired_date: "2020-01-06", desired_time: "10:00:00" },
      { ...base, id: "bc-w-altra", client_id: "c-ana", desired_date: "2099-01-07", desired_time: "10:00:00", cancel_reason: null },
    );
    saveStore(s);
  }
  const r1 = await notifyCancelledWaits();
  check("la futura s'avisa i la passada es marca sense correu", r1.notified === 1 && r1.skipped === 1, JSON.stringify(r1));
  const w = (id: string) => getStore().waitlist_entries.find((x) => x.id === id)!;
  check("totes dues queden marcades", !!w("bc-w-futura").cancel_notified_at && !!w("bc-w-passada").cancel_notified_at);
  check("una anul·lada per un altre motiu no es toca", !w("bc-w-altra").cancel_notified_at);
  const r2 = await notifyCancelledWaits();
  check("una segona passada no avisa ningú", r2.notified === 0 && r2.skipped === 0, JSON.stringify(r2));
} catch (e) {
  bad++;
  console.error(e);
} finally {
  restaura();
}

console.log(bad ? `\n${bad} casos no fan el que han de fer.\n` : "\nTot correcte.\n");
process.exit(bad ? 1 : 0);
