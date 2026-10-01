/**
 * Comptes demo i reals, separats (pas 1 del pla de l'entorn PRE). En
 * simulació, amb els comptes demo posats al magatzem amb els seus ids REALS:
 *
 *   npm run demo:check
 *
 *   · Calendari: un client real no veu ni l'Entrenador Demo ni el Fisio Demo
 *     (ni regles, ni bloquejos, ni sessions); el Client Demo només veu els demo.
 *   · Servidor: un client real no pot reservar, fer cua ni demanar una sèrie
 *     amb un professional demo (grup i fisio inclosos, que són oberts a
 *     tothom); el Client Demo tampoc amb un de real. Demo amb demo, sí.
 *   · L'equip tampoc ho barreja: «+ Nova reserva» / crear des del forat.
 *   · /prova: cap hora d'un professional demo, i una sol·licitud a una hora
 *     que només té un demo no s'hi assigna.
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

const { DEMO_TRAINER_IDS, DEMO_CLIENT_ID, DEMO_CLIENT_PROFILE_ID } = await import("../lib/demo-accounts");
const { clientBookingScope } = await import("../lib/booking-scope");
const { getStore, saveStore } = await import("../lib/mock/store");
const { getClientCenterData } = await import("../lib/data/client-calendar");
const { createClientReservation, createReservation } = await import("../lib/data/reservations");
const { joinWaitlist } = await import("../lib/data/waitlist");
const { resolveSeries } = await import("../lib/data/booking-series");
const { getPublicTrialData, createTrialBooking } = await import("../lib/data/trial-bookings");
const { addDaysStr, centerLocalToInstant, centerToday, centerWeekday } = await import("../lib/center-time");

let fallides = 0;
const check = (c: boolean, m: string) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) fallides++; };
const fails = async (fn: () => Promise<unknown>) => { try { await fn(); return null; } catch (e) { return e instanceof Error ? e.message : String(e); } };

const [E, F] = DEMO_TRAINER_IDS;
const REAL_CLIENT_PROFILE = "u-client-ana";
const LAIA = "u-trainer-laia";

try {
  console.log("\nLa regla");
  const sc = (clientId: string | null, trainerId: string | null, serviceType = "grupo_reducido" as const) =>
    clientBookingScope({ serviceType, trainerId, assignedTrainerId: null, clientId });
  check(sc("c-ana", E) === "demoMismatch", "client real + Entrenador Demo (grup): no");
  check(sc("c-ana", F) === "demoMismatch", "client real + Fisio Demo: no");
  check(sc(DEMO_CLIENT_ID, LAIA) === "demoMismatch", "Client Demo + professional real: no");
  check(sc(DEMO_CLIENT_ID, E) === "ok", "Client Demo + Entrenador Demo (grup): sí");
  check(sc("c-ana", LAIA) === "ok", "client real + professional real (grup): sí");
  check(sc("c-ana", null) === "ok", "«m'és igual qui» a la cua: es decideix en promoure");

  // Els comptes demo al magatzem, amb els ids reals.
  const s = getStore();
  const laia = s.profiles.find((p) => p.id === LAIA)!;
  const ana = s.profiles.find((p) => p.id === REAL_CLIENT_PROFILE)!;
  s.profiles.push({ ...laia, id: E, full_name: "Entrenador Demo", email: "demo.entrenador@vindibcn.com" } as never);
  s.profiles.push({ ...laia, id: F, full_name: "Fisio Demo", email: "demo.fisio@vindibcn.com", specialty: "fisioterapeuta" } as never);
  s.profiles.push({ ...ana, id: DEMO_CLIENT_PROFILE_ID, full_name: "Client Demo", email: "demo.client@vindibcn.com" } as never);
  s.clients.push({ ...s.clients.find((c) => c.id === "c-ana")!, id: DEMO_CLIENT_ID, profile_id: DEMO_CLIENT_PROFILE_ID, assigned_trainer_id: E, referral_code: "DEMO-1" } as never);
  const rule = s.availability_rules.find((r) => r.trainer_id === LAIA)!;
  let k = 0;
  for (let wd = 0; wd < 7; wd++) {
    s.availability_rules.push({ ...rule, id: `dm-e-${k++}`, trainer_id: E, weekday: wd, start_time: "09:00", end_time: "14:00", service_types: ["ep_individual", "grupo_reducido"], valid_from: "2026-01-01", valid_until: null } as never);
    s.availability_rules.push({ ...rule, id: `dm-f-${k++}`, trainer_id: F, weekday: wd, start_time: "09:00", end_time: "14:00", service_types: ["fisioterapia"], valid_from: "2026-01-01", valid_until: null } as never);
  }
  s.availability_blocks.push({ id: "dm-blk", trainer_id: E, start_at: centerLocalToInstant(addDaysStr(centerToday(), 20), "09:00").toISOString(), end_at: centerLocalToInstant(addDaysStr(centerToday(), 20), "14:00").toISOString(), reason: "Demo", created_by: null, created_at: "2026-09-01T00:00:00Z" } as never);
  // Bons de grup i fisio per a tots dos clients (grup i fisio són oberts a tothom).
  const bono = s.bonos.find((b) => b.client_id === "c-ana")!;
  for (const [cid, svc] of [["c-ana", "grupo_reducido"], ["c-ana", "fisioterapia"], [DEMO_CLIENT_ID, "grupo_reducido"], [DEMO_CLIENT_ID, "fisioterapia"]] as const)
    s.bonos.push({ ...bono, id: `dm-b-${cid}-${svc}`, client_id: cid, service_type: svc, status: "active", remaining_sessions: 10, total_sessions: 10, expires_at: null } as never);
  saveStore(s);

  // Un dia d'aquí a uns quants, a les 11 (dins de la franja dels demo).
  let day = addDaysStr(centerToday(), 3);
  while (centerWeekday(centerLocalToInstant(day, "12:00")) > 4) day = addDaysStr(day, 1);
  const at11 = centerLocalToInstant(day, "11:00").toISOString();
  const at12 = centerLocalToInstant(day, "12:00").toISOString();

  console.log("\nCalendari del client");
  const real = await getClientCenterData(REAL_CLIENT_PROFILE);
  check(!real.trainers.some((t) => DEMO_TRAINER_IDS.includes(t.id)), "client real: cap professional demo a la llista");
  check(!real.rules.some((r) => DEMO_TRAINER_IDS.includes(r.trainerId)) && !real.blocks.some((b) => DEMO_TRAINER_IDS.includes(b.trainerId)), "client real: cap regla ni bloqueig demo");
  check(real.trainers.some((t) => t.id === LAIA), "client real: la Laia sí");
  const demo = await getClientCenterData(DEMO_CLIENT_PROFILE_ID);
  check(demo.trainers.length > 0 && demo.trainers.every((t) => DEMO_TRAINER_IDS.includes(t.id)), `Client Demo: només professionals demo (${demo.trainers.map((t) => t.name).join(", ")})`);
  check(demo.rules.every((r) => DEMO_TRAINER_IDS.includes(r.trainerId)), "Client Demo: només regles demo");

  console.log("\nReservar (el client)");
  const e1 = await fails(() => createClientReservation({ profileId: REAL_CLIENT_PROFILE, trainerId: E, serviceType: "grupo_reducido", scheduledAt: at11 }));
  check(e1 === "Aquest professional no està disponible.", `client real, grup amb l'Entrenador Demo: «${e1}»`);
  const e2 = await fails(() => createClientReservation({ profileId: REAL_CLIENT_PROFILE, trainerId: F, serviceType: "fisioterapia", scheduledAt: at11 }));
  check(e2 === "Aquest professional no està disponible.", `client real, fisio amb el Fisio Demo: «${e2}»`);
  const e3 = await fails(() => createClientReservation({ profileId: DEMO_CLIENT_PROFILE_ID, trainerId: LAIA, serviceType: "grupo_reducido", scheduledAt: at11 }));
  check(e3 === "Aquest professional no està disponible.", `Client Demo, grup amb la Laia: «${e3}»`);
  const before = getStore().reservations.length;
  const ok1 = await fails(() => createClientReservation({ profileId: DEMO_CLIENT_PROFILE_ID, trainerId: F, serviceType: "fisioterapia", scheduledAt: at12 }));
  check(ok1 === null && getStore().reservations.length === before + 1, `Client Demo, fisio amb el Fisio Demo: reservat${ok1 ? ` (${ok1})` : ""}`);

  console.log("\nCua i sèries");
  const w1 = await fails(() => joinWaitlist({ profileId: REAL_CLIENT_PROFILE, trainerId: E, serviceType: "grupo_reducido", scheduledAt: at11 }));
  check(w1 === "Aquest professional no està disponible.", `client real, cua amb l'Entrenador Demo: «${w1}»`);
  const plan = await resolveSeries({ profileId: REAL_CLIENT_PROFILE, firstAt: at11, trainerId: E, serviceType: "grupo_reducido", frequency: "weekly", occurrenceCount: 4, endDate: null, bookOnlyAvailable: false, allowAlternatives: true, allowWaitlist: true });
  check(plan.scope === "demoMismatch" && plan.occurrences.length === 0, `client real, sèrie amb l'Entrenador Demo: ${plan.scope ?? "acceptada!"}`);
  const plan2 = await resolveSeries({ profileId: REAL_CLIENT_PROFILE, firstAt: at11, trainerId: LAIA, serviceType: "grupo_reducido", frequency: "weekly", occurrenceCount: 4, endDate: null, bookOnlyAvailable: false, allowAlternatives: true, allowWaitlist: true });
  check(!plan2.occurrences.some((o) => DEMO_TRAINER_IDS.includes((o as { trainerId?: string }).trainerId ?? "")), "client real, sèrie amb la Laia: cap alternativa amb un professional demo");

  console.log("\nL'equip (admin / professional)");
  const st1 = await fails(() => createReservation({ trainerId: E, scheduledAt: at11, bonoId: null, clientId: "c-ana", serviceType: "ep_individual" }));
  check(st1 === "Els professionals demo no tenen agenda per a clients reals.", `client real amb l'Entrenador Demo: «${st1}»`);
  const st2 = await fails(() => createReservation({ trainerId: LAIA, scheduledAt: at11, bonoId: null, clientId: DEMO_CLIENT_ID, serviceType: "ep_individual" }));
  check(st2 === "El Client Demo només pot reservar amb professionals demo.", `Client Demo amb la Laia: «${st2}»`);

  console.log("\n/prova");
  const pub = await getPublicTrialData();
  check(!pub.rules.some((r) => DEMO_TRAINER_IDS.includes(r.trainerId)), "cap regla d'un professional demo");
  check(pub.rules.some((r) => r.trainerId === LAIA), "la Laia sí");
  // Dissabte a les 10: només el té l'Entrenador Demo.
  let sat = addDaysStr(centerToday(), 2);
  while (centerWeekday(centerLocalToInstant(sat, "12:00")) !== 5) sat = addDaysStr(sat, 1);
  const tr = await fails(() => createTrialBooking({ fullName: "Visitant Prova", email: "visitant@exemple.test", phone: "600000000", scheduledAt: `${sat}T10:00`, ip: "203.0.113.9" } as never));
  check(tr === "slotTaken", `una prova dissabte a les 10 (només l'Entrenador Demo): ${tr ?? "acceptada!"}`);
  check(!getStore().trial_bookings.some((t) => DEMO_TRAINER_IDS.includes(t.trainer_id ?? "")), "cap prova assignada a un professional demo");
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
