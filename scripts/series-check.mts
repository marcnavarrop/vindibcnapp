/**
 * Comprova que les sèries i les alternatives entenen la mitja hora.
 *
 *   npm run series:check
 *
 * QUÈ ES COMPROVA I PER QUÈ
 *
 * Les sèries eren l'últim racó amb aritmètica d'hores senceres, i tenien dos
 * problemes de natura diferent:
 *
 *   1. La sèrie es REGENERAVA com "HH:00". `generateOccurrences` sempre ha
 *      conservat l'hora del dia, però qui la crida tornava a construir cada
 *      ocurrència a partir de l'hora sencera per no desplaçar-se amb el canvi
 *      d'hora. Amb dades en punt això era invisible; amb una sèrie de les 9:30
 *      l'hauria arrossegada sencera a les 9:00. Passava als dos llocs que
 *      generen ocurrències: l'assistent i el cron que allarga les sèries soles.
 *
 *   2. Les ALTERNATIVES es buscaven en salts d'una hora i sempre "en punt", o
 *      sigui que a una sèrie de les 9:30 mai se li hauria proposat les 10:00.
 *
 * Aquí es reprodueix l'aritmètica dels dos camins —la mateixa que fan
 * `resolveSeries` i `nextAfter`— perquè totes dues necessiten base de dades i
 * el que es vol comprovar és el CÀLCUL, no el viatge.
 */
import {
  generateOccurrences,
  nextOccurrence,
} from "../lib/booking-series-core";
import {
  slotOf,
  slotToHHMM,
  hourToSlot,
  slotsFor,
  rangesOverlap,
} from "../lib/availability-slots";
import { centerDateStr, centerSlot, centerLocalToInstant } from "../lib/center-time";

const SESSION = 60;

let fallides = 0;
const fail = (msg: string) => {
  console.error(`  ✗ ${msg}`);
  fallides++;
};
const check = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else fail(msg);
};

const horaCentre = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

// ───────── 1. L'assistent conserva els minuts a cada ocurrència ─────────

console.log("1. Les ocurrències d'una sèrie conserven l'hora exacta");

/** El mateix càlcul que fa `resolveSeries`. */
function ocurrencies(firstIso: string, setmanes: number): string[] {
  const first = new Date(firstIso);
  const firstDay = centerDateStr(first);
  const firstTime = slotToHHMM(centerSlot(first));
  return generateOccurrences({
    first: new Date(`${firstDay}T00:00:00Z`),
    frequency: "weekly",
    occurrenceCount: setmanes,
  }).map((d) =>
    centerLocalToInstant(d.toISOString().slice(0, 10), firstTime).toISOString(),
  );
}

for (const [etiqueta, iso] of [
  ["en punt (09:00)", "2026-10-05T07:00:00.000Z"],
  ["a mitja hora (09:30)", "2026-10-05T07:30:00.000Z"],
  ["a la tarda (17:30)", "2026-10-05T15:30:00.000Z"],
] as [string, string][]) {
  const hores = ocurrencies(iso, 5).map(horaCentre);
  const totesIguals = hores.every((h) => h === hores[0]);
  check(
    totesIguals && hores[0] === horaCentre(iso),
    `${etiqueta}: 5 ocurrències, totes a les ${hores[0]}`,
  );
}

// Creuant el canvi d'hora d'octubre: la sèrie no s'ha de desplaçar.
const creuant = ocurrencies("2026-10-19T07:30:00.000Z", 4).map(horaCentre);
check(
  creuant.every((h) => h === "09:30"),
  `creuant el canvi d'hora: ${creuant.join(", ")}`,
);

// ───────── 2. El cron que allarga les sèries, igual ─────────

console.log("2. L'extensió automàtica conserva l'hora exacta");

/** El mateix càlcul que fa `nextAfter` a series-extension.ts. */
function seguent(iso: string): string {
  const at = new Date(iso);
  const day = centerDateStr(at);
  const time = slotToHHMM(centerSlot(at));
  const next = nextOccurrence(new Date(`${day}T00:00:00Z`), "weekly");
  return centerLocalToInstant(next.toISOString().slice(0, 10), time).toISOString();
}

for (const [etiqueta, iso, esperat] of [
  ["09:00 → la setmana següent", "2026-10-05T07:00:00.000Z", "09:00"],
  ["09:30 → la setmana següent", "2026-10-05T07:30:00.000Z", "09:30"],
  ["20:30 → la setmana següent", "2026-10-05T18:30:00.000Z", "20:30"],
] as [string, string, string][]) {
  const h = horaCentre(seguent(iso));
  check(h === esperat, `${etiqueta}: ${h}`);
}

// ───────── 3. Les alternatives es busquen de mitja en mitja ─────────

console.log("3. Ordre en què es proposen les alternatives");

/** El recorregut de `findAlternative`, sense context ni base de dades. */
function candidats(hhmm: string, openingHour: number, closingHour: number): string[] {
  const slot = slotOf(hhmm);
  const primer = hourToSlot(openingHour);
  const ultim = hourToSlot(closingHour) - slotsFor(SESSION);
  const out: string[] = [];
  for (let delta = 1; delta <= 2 * 6; delta++)
    for (const s of [slot - delta, slot + delta])
      if (s >= primer && s <= ultim) out.push(slotToHHMM(s));
  return out;
}

const desDe930 = candidats("09:30", 7, 22);
check(
  desDe930[0] === "09:00" && desDe930[1] === "10:00",
  `des de 09:30, les dues primeres: ${desDe930.slice(0, 2).join(", ")} (abans: 08:00 i 10:00)`,
);
check(
  desDe930.includes("10:30") && desDe930.includes("08:30"),
  "des de 09:30 s'arriba a 10:30 i a 08:30, que abans no existien",
);

const desDe900 = candidats("09:00", 7, 22);
check(
  desDe900[0] === "08:30" && desDe900[1] === "09:30",
  `des de 09:00, les dues primeres: ${desDe900.slice(0, 2).join(", ")}`,
);

// L'abast no s'encongeix: ±6 hores, com abans.
check(
  desDe900.includes("15:00") && !desDe900.includes("15:30"),
  "l'abast segueix sent de ±6 hores",
);

// La sessió ha de cabre dins de l'horari del centre.
const aprop = candidats("21:00", 7, 22);
check(
  !aprop.some((h) => h > "21:00"),
  `amb el centre tancant a les 22:00, no es proposa res després de les 21:00 (${aprop.slice(0, 3).join(", ")})`,
);
const matinada = candidats("07:30", 7, 22);
check(
  !matinada.some((h) => h < "07:00"),
  "ni res abans de l'hora d'obertura",
);

// ───────── 4. L'ocupació de les alternatives, per solapament ─────────

console.log("4. Una alternativa no pot trepitjar el que ja hi ha");

const ocupa = (aIso: string, bIso: string) => {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  const ms = SESSION * 60_000;
  return rangesOverlap(a, a + ms, b, b + ms);
};

check(ocupa("2026-10-05T07:00:00Z", "2026-10-05T07:30:00Z"), "09:00 i 09:30 es trepitgen");
check(!ocupa("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z"), "09:00 i 10:00 no");
check(ocupa("2026-10-05T07:30:00Z", "2026-10-05T08:00:00Z"), "09:30 i 10:00 sí");
check(!ocupa("2026-10-05T07:00:00Z", "2026-10-05T09:00:00Z"), "09:00 i 11:00 no");

if (fallides > 0) {
  console.error(`\n✗ ${fallides} comprovacions fallides`);
  process.exit(1);
}
console.log("\n✓ Les sèries ja entenen la mitja hora.");
