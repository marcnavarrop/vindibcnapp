/**
 * Comprova que passar d'hores a slots de mitja hora NO ha mogut cap resposta.
 *
 *   npx tsx --tsconfig scripts/tsconfig.snapshot.json scripts/slots-check.mts
 *   npm run slots:check
 *
 * COM ES COMPROVA
 *
 * Aquí sota hi ha una còpia LITERAL de la lògica d'abans del canvi, la que
 * comptava en hores senceres. No s'importa de cap lloc a posta: és una fotografia
 * del comportament que hi havia, i ha de seguir sent la referència encara que el
 * codi de debò es reescrigui deu vegades més.
 *
 * Després es generen totes les regles d'hores senceres possibles (24 × 24) i es
 * pregunta el mateix a les dues implementacions per a cadascuna de les 24 hores
 * del dia. Si alguna resposta difereix, això peta.
 *
 * Les dues no són intercanviables en general —aquest és tot el sentit del canvi—
 * així que el que es compara és el que SÍ ha de coincidir:
 *
 *   · Sobre dades d'hora sencera i sessions de 60 minuts, cada pregunta d'abans
 *     té la mateixa resposta.
 *   · Els slots coberts són exactament les hores cobertes partides en dos.
 *   · Els inicis reservables en hora en punt són exactament les hores d'abans.
 *
 * I al final, les preguntes que ABANS no es podien ni formular: regles a mitja
 * hora, sessions que no hi caben, i extrems rars com les 9:15.
 */
import {
  hourToSlot,
  slotOf,
  startSlotOf,
  endSlotOf,
  slotToHHMM,
  slotsFor,
  availableSlotsOn,
  bookableStartSlotsOn,
  isSlotAvailableOn,
  isServiceAvailableOn,
  isSlotBlocked,
  type AvailabilityRuleLite,
  type AvailabilityBlockLite,
} from "../lib/availability-slots";
import type { ServiceType } from "../types/database";

const SESSION = 60;
const DAY = "2026-10-05"; // dilluns
const WD = 0;
const SVC = "ep_individual" as ServiceType;

let fallides = 0;
const fail = (msg: string) => {
  console.error(`  ✗ ${msg}`);
  fallides++;
};

// ───────────────────────── LA LÒGICA D'ABANS ─────────────────────────
// Còpia literal de lib/availability-slots.ts abans del canvi a slots.

type OldRule = {
  weekday: number;
  startHour: number;
  endHour: number;
  validFrom: string;
  validUntil: string | null;
  serviceTypes: ServiceType[];
};

function oldAvailableHoursOn(rules: OldRule[], day: string, wd: number): number[] {
  const hours = new Set<number>();
  for (const r of rules) {
    if (r.weekday !== wd) continue;
    if (day < r.validFrom) continue;
    if (r.validUntil && day > r.validUntil) continue;
    for (let h = r.startHour; h < r.endHour; h++) hours.add(h);
  }
  return [...hours].sort((a, b) => a - b);
}

function oldIsHourAvailableOn(rules: OldRule[], day: string, wd: number, h: number): boolean {
  return rules.some(
    (r) =>
      r.weekday === wd &&
      day >= r.validFrom &&
      (!r.validUntil || day <= r.validUntil) &&
      h >= r.startHour &&
      h < r.endHour,
  );
}

function oldIsServiceAvailableOn(
  rules: OldRule[], day: string, wd: number, h: number, service: ServiceType,
): boolean {
  return rules.some(
    (r) =>
      r.weekday === wd &&
      day >= r.validFrom &&
      (!r.validUntil || day <= r.validUntil) &&
      h >= r.startHour &&
      h < r.endHour &&
      r.serviceTypes.includes(service),
  );
}

function oldIsHourBlocked(blocks: AvailabilityBlockLite[], date: Date, h: number): boolean {
  const slotStart = new Date(date);
  slotStart.setHours(h, 0, 0, 0);
  const slotEnd = new Date(slotStart);
  slotEnd.setHours(h + 1, 0, 0, 0);
  return blocks.some((b) => {
    const bStart = new Date(b.startAt).getTime();
    const bEnd = new Date(b.endAt).getTime();
    return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
  });
}

/** La mateixa regla, dita en slots. */
const toNew = (r: OldRule): AvailabilityRuleLite => ({
  weekday: r.weekday,
  startSlot: hourToSlot(r.startHour),
  endSlot: hourToSlot(r.endHour),
  validFrom: r.validFrom,
  validUntil: r.validUntil,
  serviceTypes: r.serviceTypes,
});

const rule = (startHour: number, endHour: number, extra: Partial<OldRule> = {}): OldRule => ({
  weekday: WD,
  startHour,
  endHour,
  validFrom: "2026-01-01",
  validUntil: null,
  serviceTypes: [SVC],
  ...extra,
});

// ───────────── 1. Equivalència exhaustiva sobre hores senceres ─────────────

console.log("1. Equivalència sobre TOTES les regles d'hora sencera (24×24×24)");
let comparacions = 0;
for (let sh = 0; sh < 24; sh++) {
  for (let eh = sh + 1; eh <= 24; eh++) {
    const old = [rule(sh, eh)];
    const nou = old.map(toNew);

    // a) disponible / no disponible, hora a hora
    for (let h = 0; h < 24; h++) {
      const a = oldIsHourAvailableOn(old, DAY, WD, h);
      const b = isSlotAvailableOn(nou, DAY, WD, hourToSlot(h), SESSION);
      comparacions++;
      if (a !== b) fail(`regla ${sh}–${eh}, hora ${h}: abans ${a}, ara ${b}`);

      const c = oldIsServiceAvailableOn(old, DAY, WD, h, SVC);
      const d = isServiceAvailableOn(nou, DAY, WD, hourToSlot(h), SVC, SESSION);
      comparacions++;
      if (c !== d) fail(`servei, regla ${sh}–${eh}, hora ${h}: abans ${c}, ara ${d}`);
    }

    // b) els slots coberts són les hores cobertes partides en dos
    const hores = oldAvailableHoursOn(old, DAY, WD);
    const esperats = hores.flatMap((h) => [hourToSlot(h), hourToSlot(h) + 1]);
    const reals = availableSlotsOn(nou, DAY, WD);
    comparacions++;
    if (JSON.stringify(esperats) !== JSON.stringify(reals))
      fail(`cobertura, regla ${sh}–${eh}: esperats ${esperats}, reals ${reals}`);

    // c) els inicis reservables EN PUNT són exactament les hores d'abans
    const enPunt = bookableStartSlotsOn(nou, DAY, WD, SESSION)
      .filter((s) => s % 2 === 0)
      .map((s) => s / 2);
    comparacions++;
    if (JSON.stringify(hores) !== JSON.stringify(enPunt))
      fail(`inicis en punt, regla ${sh}–${eh}: abans ${hores}, ara ${enPunt}`);
  }
}
console.log(`   ${comparacions} comparacions`);

// ─────────────── 2. Diverses regles alhora i vigències ───────────────

console.log("2. Regles múltiples, dies i vigències");
const combinacions: OldRule[][] = [
  [rule(9, 13), rule(17, 20)],
  [rule(9, 13), rule(12, 15)], // solapades
  [rule(9, 10), rule(10, 11), rule(11, 12)], // consecutives
  [rule(9, 13, { weekday: 1 })], // un altre dia
  [rule(9, 13, { validFrom: "2027-01-01" })], // encara no vigent
  [rule(9, 13, { validUntil: "2026-01-01" })], // caducada
  [rule(9, 13, { serviceTypes: [] })], // sense serveis
];
for (const [i, old] of combinacions.entries()) {
  const nou = old.map(toNew);
  for (let h = 0; h < 24; h++) {
    const a = oldIsHourAvailableOn(old, DAY, WD, h);
    const b = isSlotAvailableOn(nou, DAY, WD, hourToSlot(h), SESSION);
    if (a !== b) fail(`combinació ${i}, hora ${h}: abans ${a}, ara ${b}`);
    const c = oldIsServiceAvailableOn(old, DAY, WD, h, SVC);
    const d = isServiceAvailableOn(nou, DAY, WD, hourToSlot(h), SVC, SESSION);
    if (c !== d) fail(`combinació ${i} servei, hora ${h}: abans ${c}, ara ${d}`);
  }
}
console.log(`   ${combinacions.length} combinacions`);

// ─────────────────────── 3. Bloquejos ───────────────────────

console.log("3. Bloquejos: isHourBlocked vs isSlotBlocked");
const dia = new Date(2026, 9, 5); // 5 d'octubre de 2026, hora local
const bloc = (hIni: number, mIni: number, hFi: number, mFi: number): AvailabilityBlockLite => {
  const s = new Date(dia); s.setHours(hIni, mIni, 0, 0);
  const e = new Date(dia); e.setHours(hFi, mFi, 0, 0);
  return { startAt: s.toISOString(), endAt: e.toISOString() };
};
for (const b of [bloc(9, 0, 10, 0), bloc(9, 0, 13, 0), bloc(0, 0, 24, 0), bloc(14, 0, 14, 30)]) {
  for (let h = 0; h < 24; h++) {
    const a = oldIsHourBlocked([b], dia, h);
    const c = isSlotBlocked([b], dia, hourToSlot(h), SESSION);
    if (a !== c) fail(`bloqueig ${b.startAt}–${b.endAt}, hora ${h}: abans ${a}, ara ${c}`);
  }
}
console.log("   4 bloquejos × 24 hores");

// ───────────── 4. El que ABANS no es podia ni preguntar ─────────────

console.log("4. Capacitats noves (mitges hores)");

const check = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// Una regla de 9:30 a 10:30 deixa començar a les 9:30 i no a les 9:00.
const laia: AvailabilityRuleLite = {
  weekday: WD, startSlot: slotOf("09:30"), endSlot: slotOf("10:30"),
  validFrom: "2026-01-01", validUntil: null, serviceTypes: [SVC],
};
check(!isSlotAvailableOn([laia], DAY, WD, slotOf("09:00"), SESSION), "9:30–10:30 no hauria d'obrir les 9:00");
check(isSlotAvailableOn([laia], DAY, WD, slotOf("09:30"), SESSION), "9:30–10:30 hauria d'obrir les 9:30");
check(!isSlotAvailableOn([laia], DAY, WD, slotOf("10:00"), SESSION), "9:30–10:30 no hauria d'obrir les 10:00 (acabaria fora)");

// Una regla de 9:00 a 13:00: l'última sessió d'una hora comença a les 12:00.
const mati: AvailabilityRuleLite = {
  weekday: WD, startSlot: slotOf("09:00"), endSlot: slotOf("13:00"),
  validFrom: "2026-01-01", validUntil: null, serviceTypes: [SVC],
};
const inicis = bookableStartSlotsOn([mati], DAY, WD, SESSION).map(slotToHHMM);
check(
  JSON.stringify(inicis) ===
    JSON.stringify(["09:00","09:30","10:00","10:30","11:00","11:30","12:00"]),
  `inicis de 9–13 amb sessió de 60: ${inicis}`,
);
check(!inicis.includes("12:30"), "12:30 no hi cap: acabaria a les 13:30");

// Una regla més curta que la sessió no ofereix res.
const curta: AvailabilityRuleLite = { ...mati, endSlot: slotOf("09:30") };
check(bookableStartSlotsOn([curta], DAY, WD, SESSION).length === 0, "una regla de mitja hora no admet una sessió d'una hora");
check(availableSlotsOn([curta], DAY, WD).length === 1, "però sí que cobreix un slot de capacitat");

// Dues regles consecutives NO es cusen.
const tram1: AvailabilityRuleLite = { ...mati, endSlot: slotOf("11:00") };
const tram2: AvailabilityRuleLite = { ...mati, startSlot: slotOf("11:00"), endSlot: slotOf("13:00") };
check(
  !isSlotAvailableOn([tram1, tram2], DAY, WD, slotOf("10:30"), SESSION),
  "una sessió no hauria de travessar dues regles consecutives",
);

// Arrodoniment cap a dins amb minuts que no cauen a la graella.
check(startSlotOf("09:15") === slotOf("09:30"), "un inici a les 9:15 puja a les 9:30");
check(endSlotOf("12:45") === slotOf("12:30"), "un final a les 12:45 baixa a les 12:30");
check(startSlotOf("09:00") === slotOf("09:00"), "les 9:00 en punt no es mouen");
check(endSlotOf("13:00") === slotOf("13:00"), "les 13:00 en punt no es mouen");

// Ida i tornada.
for (let s = 0; s < 48; s++)
  check(slotOf(slotToHHMM(s)) === s, `slotToHHMM/slotOf no quadren al slot ${s}`);

// Quants slots ocupa una sessió.
check(slotsFor(30) === 1 && slotsFor(60) === 2 && slotsFor(45) === 2 && slotsFor(90) === 3, "slotsFor");

console.log("   comprovades");

// ───────── 5. L'ocupació del tauler dona el mateix percentatge ─────────
//
// L'única afirmació del canvi que no és una equivalència booleana: el
// denominador es dobla (hores → mitges hores) i el numerador també, perquè una
// reserva d'una hora marca els dos slots que ocupa. La proporció ha de quedar
// igual. Es replica aquí l'aritmètica de `occupancyOf` per les dues bandes.

console.log("5. Ocupació: mateix percentatge abans i ara");
for (const [inici, fi, reservades] of [
  [9, 13, [9, 11]],
  [9, 13, []],
  [7, 22, [8, 9, 10, 17]],
  [9, 10, [9]],
] as [number, number, number[]][]) {
  const old = [rule(inici, fi)];
  const nou = old.map(toNew);

  const horesCobertes = oldAvailableHoursOn(old, DAY, WD);
  const pctAbans = (reservades.length / horesCobertes.length) * 100;

  const slotsCoberts = availableSlotsOn(nou, DAY, WD);
  const slotsReservats = new Set(
    reservades.flatMap((h) => {
      const from = hourToSlot(h);
      return Array.from({ length: slotsFor(SESSION) }, (_, i) => from + i);
    }),
  );
  const ocupats = slotsCoberts.filter((s) => slotsReservats.has(s)).length;
  const pctAra = (ocupats / slotsCoberts.length) * 100;

  if (Math.abs(pctAbans - pctAra) > 1e-9)
    fail(`ocupació ${inici}–${fi} amb ${reservades.length} reserves: abans ${pctAbans}%, ara ${pctAra}%`);
}
console.log("   4 escenaris");

// ─────────────────────────── Resultat ───────────────────────────

if (fallides > 0) {
  console.error(`\n✗ ${fallides} comprovacions fallides`);
  process.exit(1);
}
console.log("\n✓ Tot correcte: el canvi a slots no mou cap resposta d'abans.");
