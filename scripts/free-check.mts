/**
 * Comprova que els forats "lliures" de les pantalles són els que el servidor
 * acceptaria.
 *
 *   npm run free:check
 *
 * PER QUÈ
 *
 * Abans hi havia tres càlculs de "lliure" i dos s'equivocaven (auditoria dels
 * calendaris): l'agenda de l'equip deia que en Raul era lliure el dijous a les
 * 7:00 tenint-hi la Laura, i tant l'agenda com el client deien que ho era el
 * dissabte a les 10:00 amb la Irene a les 10:30. El servidor, en tots dos
 * casos, responia «Aquesta franja ja està ocupada». Ara totes tres pantalles fan
 * servir `freeServicesAt` (lib/free-slots.ts).
 *
 * COM ES COMPROVA
 *
 *   1. Els casos concrets de l'auditoria, amb la resposta escrita a mà.
 *   2. Equivalència exhaustiva: per a cada professional, dia, mitja hora i
 *      servei, la resposta de les pantalles ha de ser la del servidor. El
 *      servidor és `offeredServices` + els ocupants que busca en crear la
 *      reserva (`mockOccupants` + `mockActiveHoldsAt`) + `slotHasRoom`.
 *      Es pregunta amb les tres formes d'ocupació que fan servir les
 *      pantalles: l'agenda (reserves i proves per separat), el client (les
 *      proves ja com a reserves) i /prova (claus de slot ocupat).
 *
 * Tot passa en memòria: no es toca el mock de /tmp.
 */
process.env.TZ = "Europe/Madrid";
process.env.NEXT_PUBLIC_USE_MOCK = "true";

const { offeredServices, localDateStr, localSlotOf, slotsFor, hourToSlot } =
  await import("../lib/availability-slots");
const { freeServicesAt, occupancyFromSessions, occupancyFromSlotKeys } =
  await import("../lib/free-slots");
const { mockOccupants, slotHasRoom } = await import("../lib/data/reservations");
const { mockActiveHoldsAt } = await import("../lib/data/trial-bookings");
const { SERVICE_TYPES, SESSION_DURATION_MINUTES } = await import("../lib/labels");
type Store = import("../lib/mock/store").Store;
type ServiceType = import("../types/database").ServiceType;
type TrainerRuleLite = import("../lib/availability-slots").TrainerRuleLite;
type TrainerBlockLite = import("../lib/availability-slots").TrainerBlockLite;

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

// ───────────────────────────── L'ESCENARI ─────────────────────────────
// Setmana del 5 d'octubre de 2026. Dijous 8 i dissabte 10.

const THU = "2026-10-08";
const SAT = "2026-10-10";
const RAUL = "t-raul";
const ANNA = "t-anna";
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00`);
const iso = (day: string, hhmm: string) => at(day, hhmm).toISOString();
const dayDate = (day: string) => new Date(`${day}T00:00:00`);

const ALL: ServiceType[] = ["ep_individual", "ep_parejas", "grupo_reducido"];
const rule = (
  trainerId: string,
  weekday: number,
  from: number,
  to: number,
  serviceTypes: ServiceType[],
): TrainerRuleLite => ({
  trainerId,
  weekday,
  startSlot: hourToSlot(from),
  endSlot: hourToSlot(to),
  validFrom: "2026-01-01",
  validUntil: null,
  serviceTypes,
});
const rules: TrainerRuleLite[] = [
  rule(RAUL, 3, 7, 13, ALL),
  rule(RAUL, 5, 9, 14, ["ep_individual", "grupo_reducido"]),
  rule(ANNA, 3, 9, 13, ["ep_individual"]),
];
const blocks: TrainerBlockLite[] = [
  // L'Anna no hi és el dijous de 9:00 a 10:00.
  { trainerId: ANNA, startAt: iso(THU, "09:00"), endAt: iso(THU, "10:00") },
];

let n = 0;
const res = (
  trainer: string,
  day: string,
  hhmm: string,
  service: ServiceType,
  status: "booked" | "cancelled" = "booked",
) => ({
  id: `r-${++n}`,
  client_id: `c-${n}`,
  bono_id: null,
  trainer_id: trainer,
  scheduled_at: iso(day, hhmm),
  duration_minutes: SESSION_DURATION_MINUTES,
  ends_at: "",
  service_type: service,
  status,
  series_id: null,
  is_complimentary: false,
  cancelled_by_center: false,
  created_at: "2026-01-01T00:00:00.000Z",
});
const HOUR = 3_600_000;
const trial = (
  trainer: string,
  day: string,
  hhmm: string,
  status: "pending" | "confirmed",
  expiresInMs: number,
) => ({
  id: `tb-${++n}`,
  trainer_id: trainer,
  scheduled_at: iso(day, hhmm),
  service_type: "ep_individual" as ServiceType,
  status,
  expires_at: new Date(Date.now() + expiresInMs).toISOString(),
});

const store = {
  reservations: [
    res(RAUL, THU, "07:00", "ep_parejas"), // la Laura
    res(RAUL, THU, "10:00", "ep_individual", "cancelled"), // no ocupa
    res(RAUL, SAT, "09:00", "grupo_reducido"), // grup 2/4
    res(RAUL, SAT, "09:00", "grupo_reducido"),
    res(RAUL, SAT, "10:30", "ep_individual"), // la Irene
    res(RAUL, SAT, "12:00", "grupo_reducido"), // grup ple 4/4
    res(RAUL, SAT, "12:00", "grupo_reducido"),
    res(RAUL, SAT, "12:00", "grupo_reducido"),
    res(RAUL, SAT, "12:00", "grupo_reducido"),
  ],
  trial_bookings: [
    trial(ANNA, THU, "10:30", "confirmed", -HOUR), // confirmada: ocupa
    trial(ANNA, THU, "12:00", "pending", -HOUR), // caducada: no ocupa
    trial(RAUL, THU, "11:00", "pending", HOUR), // pendent viva: ocupa
  ],
} as unknown as Store;

// ─────────────────── LES TRES FORMES D'OCUPACIÓ ───────────────────

const liveTrials = store.trial_bookings.filter(
  (t) =>
    t.status === "confirmed" ||
    (t.status === "pending" && new Date(t.expires_at).getTime() >= Date.now()),
);
const booked = store.reservations.filter((r) => r.status === "booked");

// L'agenda de l'equip: reserves i proves per separat (weekly-calendar.tsx).
const teamOcc = occupancyFromSessions([
  ...booked.map((r) => ({
    trainerId: r.trainer_id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
  })),
  ...liveTrials.map((t) => ({
    trainerId: t.trainer_id,
    scheduledAt: t.scheduled_at,
    serviceType: t.service_type,
  })),
]);
// El client: les proves ja arriben com a reserves 'booked' (client-calendar.ts).
const clientOcc = occupancyFromSessions(
  [...booked, ...liveTrials].map((r) => ({
    trainerId: r.trainer_id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
  })),
);
// /prova: claus de slot, construïdes com a `getPublicTrialData`.
const busy = new Set<string>();
for (const x of [...booked, ...liveTrials]) {
  const d = new Date(x.scheduled_at);
  const from = localSlotOf(d);
  for (let i = 0; i < slotsFor(SESSION_DURATION_MINUTES); i++)
    busy.add(`${x.trainer_id}|${localDateStr(d)}|${from + i}`);
}
const provaOcc = occupancyFromSlotKeys(busy);

// ───────────────────────────── EL SERVIDOR ─────────────────────────────

function serverAccepts(trainerId: string, day: string, slot: number, s: ServiceType) {
  const date = dayDate(day);
  if (!offeredServices(rules, blocks, trainerId, date, slot, SESSION_DURATION_MINUTES).has(s))
    return false;
  const start = new Date(date);
  start.setHours(0, slot * 30, 0, 0);
  const occupants = [
    ...mockOccupants(store, trainerId, start.toISOString(), SESSION_DURATION_MINUTES),
    ...mockActiveHoldsAt(store, trainerId, start.toISOString(), SESSION_DURATION_MINUTES),
  ];
  return slotHasRoom(occupants, s);
}

const free = (
  trainerId: string,
  day: string,
  hhmm: string,
  occupancy = teamOcc,
) => {
  const d = at(day, hhmm);
  return freeServicesAt({
    rules,
    blocks,
    trainerId,
    date: dayDate(day),
    slot: localSlotOf(d),
    durationMinutes: SESSION_DURATION_MINUTES,
    occupancy,
  });
};
const show = (s: Set<ServiceType>) => (s.size ? [...s].sort().join(", ") : "∅");
const expect = (
  label: string,
  got: Set<ServiceType>,
  want: ServiceType[],
) => {
  const ok = got.size === want.length && want.every((w) => got.has(w));
  check(ok, `${label}: ${show(got)}${ok ? "" : ` (esperat ${want.length ? want.join(", ") : "∅"})`}`);
};

// ──────────────────────────── 1. ELS CASOS ────────────────────────────

console.log("\nCasos de l'auditoria");
{
  const wasFree = offeredServices(rules, blocks, RAUL, dayDate(THU), hourToSlot(7), 60);
  check(wasFree.size > 0, `abans, l'agenda deia que en Raul era lliure dj 7:00 (${show(wasFree)})`);
}
expect("Raul dj 7:00 amb la Laura (parelles)", free(RAUL, THU, "07:00"), []);
expect("Raul dj 7:30 (tapada per la Laura)", free(RAUL, THU, "07:30"), []);
expect("Raul ds 10:00 amb la Irene a les 10:30 · agenda", free(RAUL, SAT, "10:00"), []);
expect("Raul ds 10:00 amb la Irene a les 10:30 · client", free(RAUL, SAT, "10:00", clientOcc), []);
expect("Raul ds 9:00 amb grup 2/4: només grup", free(RAUL, SAT, "09:00"), ["grupo_reducido"]);
expect("Raul ds 11:00 (la Irene fins a les 11:30)", free(RAUL, SAT, "11:00"), []);

console.log("\nAltres casos");
expect("Raul dj 8:00, just després de la Laura", free(RAUL, THU, "08:00"), ALL);
expect("Raul dj 10:00, amb una reserva cancel·lada", free(RAUL, THU, "10:00"), ALL);
expect("Raul dj 11:00, prova pendent viva", free(RAUL, THU, "11:00"), []);
expect("Raul dj 10:30, la prova de les 11:00 es trepitja", free(RAUL, THU, "10:30"), []);
expect("Raul ds 12:00, grup ple 4/4", free(RAUL, SAT, "12:00"), []);
expect("Raul ds 13:30, la sessió ja no hi cap sencera", free(RAUL, SAT, "13:30"), []);
expect("Anna dj 9:00, bloquejada", free(ANNA, THU, "09:00"), []);
expect("Anna dj 10:00, la prova confirmada de les 10:30", free(ANNA, THU, "10:00"), []);
expect("Anna dj 12:00, prova pendent caducada", free(ANNA, THU, "12:00"), ["ep_individual"]);
expect("/prova · Raul ds 10:00", free(RAUL, SAT, "10:00", provaOcc), []);
expect("/prova · Anna dj 12:00", free(ANNA, THU, "12:00", provaOcc), ["ep_individual"]);

// ─────────────────────── 2. EQUIVALÈNCIA SENCERA ───────────────────────

console.log("\nEquivalència amb el servidor");
const kinds = [
  ["agenda", teamOcc],
  ["client", clientOcc],
] as const;
let preguntes = 0;
let diferencies = 0;
let lliures = 0;
for (const trainerId of [RAUL, ANNA])
  for (const day of [THU, SAT])
    for (let slot = 0; slot < 48; slot++) {
      for (const [name, occ] of kinds) {
        const got = freeServicesAt({
          rules,
          blocks,
          trainerId,
          date: dayDate(day),
          slot,
          durationMinutes: SESSION_DURATION_MINUTES,
          occupancy: occ,
        });
        for (const s of SERVICE_TYPES) {
          preguntes++;
          if (got.has(s)) lliures++;
          if (got.has(s) !== serverAccepts(trainerId, day, slot, s)) {
            diferencies++;
            if (diferencies <= 10)
              console.error(`  ✗ ${name} ${trainerId} ${day} slot ${slot} ${s}`);
          }
        }
      }
      // /prova només pregunta pel servei de prova, i el servidor el tracta com
      // un individual.
      const got = freeServicesAt({
        rules,
        blocks,
        trainerId,
        date: dayDate(day),
        slot,
        durationMinutes: SESSION_DURATION_MINUTES,
        occupancy: provaOcc,
      }).has("ep_individual");
      preguntes++;
      if (got !== serverAccepts(trainerId, day, slot, "ep_individual")) {
        diferencies++;
        if (diferencies <= 10)
          console.error(`  ✗ /prova ${trainerId} ${day} slot ${slot}`);
      }
    }
check(diferencies === 0, `${preguntes} preguntes, ${diferencies} diferències`);
// Que no passi per "tot és ple": hi ha d'haver sí i no.
check(lliures > 0 && lliures < preguntes, `${lliures} respostes lliures, la resta no`);

console.log(fallides ? `\n✗ ${fallides} fallides` : "\n✓ Tot correcte");
process.exit(fallides ? 1 : 0);
