/**
 * Comprova la llista d'hores del client (lib/client-day-slots.ts).
 *
 *   npm run dayslots:check
 *
 *   1. Diu el mateix que la regla del servidor: cada hora lliure està coberta
 *      (`isSessionCovered`) i té lloc (`hasRoom`), i no en falta cap que
 *      `freeServicesAt` doni per lliure (amb la regla d'amb qui de C1).
 *   2. Amb qui (C1): individual només amb l'assignat; fisio i grup, amb tothom
 *      que ho ofereixi, sigui quina sigui l'especialitat.
 *   3. Grups: places, «grup nou», ple amb cua, i la cua on ja ets.
 *   4. Antelació mínima, hores passades, bloquejos i hores que ja tens ocupades.
 *   5. El mateix resultat amb el procés en qualsevol zona horària: és el que
 *      evita l'error d'hidratació #418 entre el servidor (UTC) i el navegador.
 */
process.env.TZ = "UTC";

const S = await import("../lib/client-day-slots");
const { isSessionCovered } = await import("../lib/availability-coverage");
const { freeServicesAt, hasRoom, occupancyFromSessions } = await import("../lib/free-slots");
const { centerLocalToInstant, addDaysStr } = await import("../lib/center-time");
const { hourToSlot, slotsFor } = await import("../lib/availability-slots");
const { clientBookingScope } = await import("../lib/booking-scope");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

// Un dimarts fix: 6 d'octubre de 2026 (setmana normal, sense canvi d'hora).
const DAY = "2026-10-06";
const at = (hhmm: string, day = DAY) => centerLocalToInstant(day, hhmm).toISOString();
const NOW = new Date(at("07:00", "2026-10-05")).getTime(); // dilluns a les 7

const LAIA = "laia", RAUL = "raul", JORDI = "jordi", NEUS = "neus";
const rule = (trainerId: string, svcs: string[], from = 16, to = 42) => ({
  trainerId, weekday: 1, startSlot: from, endSlot: to, validFrom: "2026-01-01", validUntil: null,
  serviceTypes: svcs as never,
});
const base = {
  rules: [
    rule(LAIA, ["ep_individual", "ep_parejas", "grupo_reducido"]),
    rule(RAUL, ["ep_individual", "grupo_reducido", "fisioterapia"]), // entrenador que fa fisio
    rule(JORDI, ["fisioterapia"]),
    rule(NEUS, ["fisioterapia"], 18, 24), // 9-12
  ],
  blocks: [] as { trainerId: string; startAt: string; endAt: string }[],
  trainerIds: [LAIA, RAUL, JORDI, NEUS],
  reservations: [] as import("../lib/client-day-slots").SlotReservation[],
  assignedTrainerId: LAIA as string | null,
  nowMs: NOW,
  minBookingHours: 0,
  openingHour: 7,
  closingHour: 22,
  waitlistEnabled: true,
  waitlist: [] as { id: string; trainerId: string | null; desiredAt: string }[],
};
let n = 0;
const res = (trainerId: string, hhmm: string, serviceType: string, isOwn = false, mateName: string | null = null) => ({
  id: `r${++n}`, trainerId, scheduledAt: at(hhmm), serviceType: serviceType as never, status: "booked", isOwn, mateName,
});

console.log("\n1. Amb qui (C1)");
{
  const p = S.prepare(base);
  const ind = S.hoursFor(p, DAY, "ep_individual");
  check(ind.length > 0 && ind.every((r) => r.kind === "free" && r.trainerIds.join() === LAIA), "individual: només la Laia (la seva), mai Raul");
  const fis = S.hoursFor(p, DAY, "fisioterapia");
  const at10 = fis.find((r) => r.hhmm === "10:00");
  check(at10?.kind === "free" && [RAUL, JORDI, NEUS].every((t) => at10.trainerIds.includes(t)), "fisio a les 10: Raul (especialitat «entrenador»), Jordi i Neus");
  const sense = S.prepare({ ...base, assignedTrainerId: null });
  check(S.hoursFor(sense, DAY, "ep_individual").length === 0 && S.hoursFor(sense, DAY, "ep_parejas").length === 0, "sense entrenador: cap hora d'individual ni de parelles");
  check(S.lacksTrainerFor("ep_individual", null) && !S.lacksTrainerFor("fisioterapia", null), "lacksTrainerFor: individual sí, fisio no");
  check(S.hoursFor(sense, DAY, "grupo_reducido").length > 0 && S.hoursFor(sense, DAY, "fisioterapia").length > 0, "sense entrenador: grups i fisio, sí");
}

console.log("\n2. Grups");
{
  const reservations = [
    res(LAIA, "10:00", "grupo_reducido", false, "Pau"),
    res(LAIA, "10:00", "grupo_reducido", false, "Oriol"),
    ...["Rosa", "Pere", "Irene", "Jaume"].map((m) => res(LAIA, "17:00", "grupo_reducido", false, m)),
    res(RAUL, "12:00", "ep_individual"),
  ];
  const waitlist = [{ id: "w1", trainerId: LAIA, desiredAt: at("17:00") }];
  const p = S.prepare({ ...base, reservations, waitlist });
  const g = S.hoursFor(p, DAY, "grupo_reducido");
  const g10 = g.find((r) => r.kind === "group" && r.trainerId === LAIA && r.hhmm === "10:00");
  check(g10?.kind === "group" && g10.count === 2 && g10.canJoin && g10.mates.join() === "Pau,Oriol", "Laia 10:00: 2 de 4, s'hi pot apuntar, amb els noms");
  const g17 = g.find((r) => r.kind === "group" && r.trainerId === LAIA && r.hhmm === "17:00");
  check(g17?.kind === "group" && g17.count === 4 && !g17.canJoin && g17.canWait && g17.waitingEntryId === "w1", "Laia 17:00: ple, amb cua, i ja hi ets (w1)");
  check(!S.isBookable(g17!), "un grup ple no compta com a hora reservable");
  const r9 = g.find((r) => r.kind === "group" && r.trainerId === RAUL && r.hhmm === "09:00");
  check(r9?.kind === "group" && r9.count === 0 && r9.canJoin, "Raul 9:00: grup nou (0), s'hi pot apuntar");
  check(!g.some((r) => r.kind === "group" && r.trainerId === RAUL && (r.hhmm === "12:00" || r.hhmm === "11:30" || r.hhmm === "12:30")), "Raul 12:00 amb una individual: cap grup a 11:30, 12:00 ni 12:30");
  const off = S.prepare({ ...base, reservations, waitlistEnabled: false });
  const g17off = S.hoursFor(off, DAY, "grupo_reducido").find((r) => r.kind === "group" && r.trainerId === LAIA && r.hhmm === "17:00");
  check(g17off?.kind === "group" && !g17off.canWait, "cua tancada pel centre: ple i sense cua");
}

console.log("\n3. Antelació, passat, bloquejos i hores ocupades");
{
  const nowDay = new Date(at("10:10")).getTime();
  const p = S.prepare({ ...base, nowMs: nowDay, minBookingHours: 2 });
  const ind = S.hoursFor(p, DAY, "ep_individual");
  check(ind[0]?.hhmm === "12:30", `amb 2 h d'antelació a les 10:10, la primera és a les 12:30 (${ind[0]?.hhmm})`);
  const blocked = S.prepare({ ...base, blocks: [{ trainerId: LAIA, startAt: at("12:30"), endAt: at("13:00") }] });
  const b = S.hoursFor(blocked, DAY, "ep_individual").map((r) => r.hhmm);
  check(!b.includes("12:00") && !b.includes("12:30") && b.includes("11:30") && b.includes("13:00"), "un bloqueig de 12:30 a 13:00 tapa 12:00 i 12:30, i no 11:30 ni 13:00");
  const mine = S.prepare({ ...base, reservations: [res(LAIA, "10:00", "ep_individual", true)] });
  const m = S.hoursFor(mine, DAY, "ep_individual");
  check(m.some((r) => r.kind === "own" && r.hhmm === "10:00"), "la teva de les 10:00 surt com a teva");
  check(!m.some((r) => r.kind === "free" && ["09:30", "10:00", "10:30"].includes(r.hhmm)), "i tapa 9:30, 10:00 i 10:30");
  const f = S.hoursFor(mine, DAY, "fisioterapia").map((r) => r.hhmm);
  check(!f.includes("10:00") && !f.includes("10:30") && f.includes("11:00"), "també a fisio: no et proposa res que es trepitgi amb la teva");
  const late = S.prepare({ ...base, nowMs: new Date(at("21:00")).getTime() });
  check(S.hoursFor(late, DAY, "ep_individual").length === 0, "a les 21:00 ja no queda res aquell dia");
}

console.log("\n4. Diu el mateix que la regla del servidor i que freeServicesAt");
{
  const reservations = [
    res(LAIA, "10:00", "grupo_reducido", false, "Pau"),
    res(RAUL, "12:00", "ep_individual"),
    res(JORDI, "09:30", "fisioterapia"),
  ];
  const input = { ...base, reservations };
  const p = S.prepare(input);
  const occ = occupancyFromSessions(reservations.map((r) => ({ trainerId: r.trainerId, scheduledAt: r.scheduledAt, serviceType: r.serviceType })));
  let bad = 0, missing = 0, compared = 0;
  for (const svc of ["ep_individual", "ep_parejas", "grupo_reducido", "fisioterapia"] as const) {
    const rows = S.hoursFor(p, DAY, svc);
    // (a) Tot el que ofereix passa la regla del servidor.
    for (const r of rows) {
      const ts = r.kind === "free" ? r.trainerIds : r.kind === "group" && r.canJoin ? [r.trainerId] : [];
      for (const t of ts) {
        const ok =
          isSessionCovered(input.rules.filter((x) => x.trainerId === t), [], r.at, 60, svc) &&
          hasRoom(occ(t, new Date(r.at), 60), svc);
        if (!ok) bad++;
      }
    }
    // (b) I no se'n deixa cap que freeServicesAt (navegador a Madrid) dona per lliure.
    process.env.TZ = "Europe/Madrid";
    for (let slot = hourToSlot(7); slot <= hourToSlot(22) - slotsFor(60); slot++) {
      const d = new Date(`${DAY}T00:00:00`);
      for (const t of input.trainerIds) {
        if (clientBookingScope({ serviceType: svc, trainerId: t, assignedTrainerId: LAIA }) !== "ok") continue;
        const free = freeServicesAt({ rules: input.rules, blocks: [], trainerId: t, date: d, slot, occupancy: occ }).has(svc);
        if (!free) continue;
        compared++;
        const hh = `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
        const found = rows.some((r) => r.hhmm === hh && ((r.kind === "free" && r.trainerIds.includes(t)) || (r.kind === "group" && r.trainerId === t && r.canJoin)));
        if (!found) missing++;
      }
    }
    process.env.TZ = "UTC";
  }
  check(bad === 0, `cap hora oferta que el servidor rebutjaria (${bad})`);
  check(missing === 0 && compared > 50, `cap hora lliure de freeServicesAt que falti a la llista (${compared} comparades, ${missing} que falten)`);
}

console.log("\n5. Igual en qualsevol zona horària (sense #418)");
{
  const input = {
    ...base,
    reservations: [res(LAIA, "10:00", "grupo_reducido", false, "Pau"), res(LAIA, "18:00", "ep_individual", true)],
  };
  const snapshot = () => {
    const p = S.prepare(input);
    const days = S.stripDays("2026-10-05", 7);
    return JSON.stringify({
      rows: (["ep_individual", "grupo_reducido", "fisioterapia"] as const).map((s) => S.hoursFor(p, DAY, s)),
      counts: S.countsFor(p, days, "ep_individual"),
      next: S.upcomingOwn(input.reservations, NOW).map((r) => r.id),
    });
  };
  const outs = ["UTC", "Europe/Madrid", "Pacific/Kiritimati", "America/Los_Angeles"].map((tz) => {
    process.env.TZ = tz;
    return snapshot();
  });
  process.env.TZ = "UTC";
  check(outs.every((o) => o === outs[0]), "UTC, Madrid, Kiritimati (UTC+14) i Los Angeles donen exactament el mateix");
  const strip = S.stripDays("2026-10-24", 10);
  check(
    strip.length === 10 && new Set(strip).size === 10 && strip[1] === "2026-10-25" && strip[8] === "2026-11-01" && strip[9] === addDaysStr("2026-11-01", 1),
    "la tira de dies creua el canvi d'hora (25 d'octubre) i el canvi de mes sense saltar-se ni repetir cap dia",
  );
}

console.log(fallides ? `\n✗ ${fallides} fallades` : "\n✓ La llista d'hores del client diu el mateix que el servidor, a qualsevol zona.");
process.exit(fallides ? 1 : 0);
