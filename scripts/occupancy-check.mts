/**
 * L'ocupació que veuen el calendari del client, /prova i les sèries: amb
 * final i sencera, en simulació:
 *
 *   npm run occupancy:check
 *
 *   · `fetchAllRows` porta totes les files encara que passin del sostre (aquí,
 *     2.500 amb un sostre de 1000), i s'atura si la consulta no té final.
 *   · El calendari del client porta totes les reserves de la tira (fins avui +
 *     STRIP_DAYS) i res de més enllà.
 *   · /prova veu ocupada una hora del dia 25 i no mira el dia 40 (fora de
 *     TRIAL_MAX_ADVANCE_DAYS).
 *   · Una sèrie setmanal de 52 setmanes veu ocupada la setmana 40.
 *
 * La lectura per pàgines contra PostgREST es va provar a part, llegint a
 * producció. Treballa sobre el fitxer de la simulació i el deixa tal com era.
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
const { fetchAllRows } = await import("../lib/supabase/fetch-all");
const { getClientCenterData } = await import("../lib/data/client-calendar");
const { getPublicTrialData } = await import("../lib/data/trial-bookings");
const { resolveSeries } = await import("../lib/data/booking-series");
const { STRIP_DAYS } = await import("../lib/client-day-slots");
const { TRIAL_MAX_ADVANCE_DAYS } = await import("../lib/data/trial-bookings.constants");
const { addDaysStr, centerDayStart, centerLocalToInstant, centerToday, centerWeekday, centerDateStr } = await import("../lib/center-time");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

try {
  console.log("\nfetchAllRows");
  {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    let calls = 0;
    const got = await fetchAllRows(async (a, b) => {
      calls++;
      return { data: rows.slice(a, Math.min(b + 1, a + 1000)), error: null }; // el sostre talla a 1000
    }, 1000);
    check(got.length === 2500 && calls === 3, `2.500 files amb sostre de 1000: ${got.length} en ${calls} crides`);
    let parat = false;
    try {
      await fetchAllRows(async () => ({ data: Array.from({ length: 1000 }, () => ({})), error: null }), 1000);
    } catch {
      parat = true;
    }
    check(parat, "una consulta sense final s'atura (50 pàgines) en comptes de llegir per sempre");
    let error = false;
    try { await fetchAllRows(async () => ({ data: null, error: { message: "x" } })); } catch { error = true; }
    check(error, "un error de la base es propaga, no es converteix en «cap fila»");
  }

  // 2.500 reserves dins de la tira, repartides; i dues fora: el dia 25 i el 40.
  const s = getStore();
  const today = centerToday();
  for (let i = 0; i < 2500; i++) {
    const day = addDaysStr(today, 1 + (i % STRIP_DAYS));
    const hh = String(8 + (i % 12)).padStart(2, "0");
    const at = centerLocalToInstant(day, `${hh}:00`).toISOString();
    s.reservations.push({
      id: `oc-${i}`, client_id: i % 2 ? "c-pau" : "c-marta", bono_id: null, trainer_id: i % 3 ? "u-trainer-laia" : "u-trainer-jordi",
      scheduled_at: at, duration_minutes: 60, ends_at: new Date(Date.parse(at) + 3_600_000).toISOString(),
      service_type: "ep_individual", status: "booked", series_id: null, is_complimentary: false,
      cancelled_by_center: false, created_at: at,
    } as never);
  }
  const at25 = centerLocalToInstant(addDaysStr(today, 25), "11:00").toISOString();
  const at40 = centerLocalToInstant(addDaysStr(today, 40), "11:00").toISOString();
  for (const [id, at] of [["oc-d25", at25], ["oc-d40", at40]] as const)
    s.reservations.push({
      id, client_id: "c-pau", bono_id: null, trainer_id: "u-trainer-laia", scheduled_at: at, duration_minutes: 60,
      ends_at: new Date(Date.parse(at) + 3_600_000).toISOString(), service_type: "ep_individual", status: "booked",
      series_id: null, is_complimentary: false, cancelled_by_center: false, created_at: at,
    } as never);
  // La Laia disponible cada dia de 8 a 21 (per a /prova i les sèries).
  for (let wd = 0; wd < 7; wd++)
    s.availability_rules.push({
      id: `oc-r-${wd}`, trainer_id: "u-trainer-laia", weekday: wd, start_time: "08:00", end_time: "21:00",
      valid_from: "2026-01-01", valid_until: null, service_types: ["ep_individual"], created_at: "2026-01-01T00:00:00Z",
    } as never);
  saveStore(s);

  console.log("\nCalendari del client");
  {
    const data = await getClientCenterData("u-client-ana");
    const ids = new Set(data.reservations.map((r) => r.id));
    const dins = Array.from({ length: 2500 }, (_, i) => `oc-${i}`).every((id) => ids.has(id));
    check(dins, `les 2.500 reserves de la tira hi són (${[...ids].filter((x) => x.startsWith("oc-")).length})`);
    const fi = centerDayStart(addDaysStr(today, STRIP_DAYS + 1)).toISOString();
    check(!ids.has("oc-d40"), "la del dia 40 (fora de la tira) no hi és");
    check(data.reservations.every((r) => r.scheduledAt < fi), `cap reserva més enllà d'avui + ${STRIP_DAYS} + 1`);
  }

  console.log("\n/prova");
  {
    const pub = await getPublicTrialData();
    const key = (iso: string) => `u-trainer-laia|${centerDateStr(new Date(iso))}|`;
    check(pub.busy.some((b) => b.startsWith(key(at25))), "el dia 25 a les 11 surt ocupat");
    check(!pub.busy.some((b) => b.startsWith(key(at40))), `el dia 40 no hi és (fora de ${TRIAL_MAX_ADVANCE_DAYS} dies)`);
  }

  console.log("\nSèrie de 52 setmanes");
  {
    // Un dimarts d'aquí a una setmana, a les 19:00; la setmana 40 ocupada.
    let d = addDaysStr(today, 7);
    while (centerWeekday(centerLocalToInstant(d, "12:00")) !== 1) d = addDaysStr(d, 1);
    const first = centerLocalToInstant(d, "19:00");
    const w40 = centerLocalToInstant(addDaysStr(d, 40 * 7), "19:00").toISOString();
    const st = getStore();
    st.reservations.push({
      id: "oc-w40", client_id: "c-pau", bono_id: null, trainer_id: "u-trainer-laia", scheduled_at: w40, duration_minutes: 60,
      ends_at: new Date(Date.parse(w40) + 3_600_000).toISOString(), service_type: "ep_individual", status: "booked",
      series_id: null, is_complimentary: false, cancelled_by_center: false, created_at: w40,
    } as never);
    const b1 = st.bonos.find((b) => b.id === "b-1");
    if (b1) { b1.remaining_sessions = 60; b1.total_sessions = 60; }
    saveStore(st);
    const plan = await resolveSeries({
      profileId: "u-client-ana", firstAt: first.toISOString(), trainerId: "u-trainer-laia", serviceType: "ep_individual",
      frequency: "weekly", occurrenceCount: 52, endDate: null, bookOnlyAvailable: false, allowAlternatives: false, allowWaitlist: false,
    });
    const o40 = plan.occurrences.find((o) => o.requestedAt === w40);
    check(plan.occurrences.length >= 41, `la sèrie arriba a la setmana 40 (${plan.occurrences.length} ocurrències)`);
    check(!!o40 && o40.status !== "confirmada", `la setmana 40 no surt lliure (${o40?.status ?? "no hi és"})`);
    const o39 = plan.occurrences.find((o) => o.requestedAt === centerLocalToInstant(addDaysStr(d, 39 * 7), "19:00").toISOString());
    check(o39?.status === "confirmada", "la 39, lliure, sí que es confirma");
  }
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
