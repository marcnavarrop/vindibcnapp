/**
 * Comprova la validació de servidor de les franges de disponibilitat.
 *
 *   npm run availability:check
 *
 * PER QUÈ EXISTEIX
 *
 * Fins al bloc 2 aquí no hi havia res a comprovar: les Server Actions agafaven
 * `String(formData.get("startTime"))` i ho enviaven a la base tal qual. L'única
 * cosa que impedia desar una hora rara era el `step` de l'`<input type="time">`,
 * i això no és una validació —es pot treure des del navegador, i llavors la
 * franja s'desava sense que ningú digués res.
 *
 * Les proves van pel camí de debò (`submitAvailabilityRules`), no per les
 * funcions de validació soltes: el que ha de quedar tancat és l'entrada, no una
 * funció auxiliar que podria deixar de cridar-se.
 *
 * Corre en mode simulació i deixa el magatzem com estava.
 */
process.env.NEXT_PUBLIC_USE_MOCK = "true";

const { submitAvailabilityRules, submitAvailabilityUpdate } = await import(
  "../lib/data/availability-submit"
);
const { getStore, saveStore } = await import("../lib/mock/store");

const TRAINER = "u-trainer-laia";

let fallides = 0;
const fail = (msg: string) => {
  console.error(`  ✗ ${msg}`);
  fallides++;
};

type Camps = {
  startTime?: string;
  endTime?: string;
  weekdays?: string[];
  serviceTypes?: string[];
  validFrom?: string;
  validUntil?: string;
  id?: string;
};

function fd(c: Camps): FormData {
  const f = new FormData();
  if (c.startTime !== undefined) f.set("startTime", c.startTime);
  if (c.endTime !== undefined) f.set("endTime", c.endTime);
  if (c.validFrom !== undefined) f.set("validFrom", c.validFrom);
  if (c.validUntil !== undefined) f.set("validUntil", c.validUntil);
  if (c.id !== undefined) f.set("id", c.id);
  for (const d of c.weekdays ?? ["0"]) f.append("weekdays", d);
  for (const s of c.serviceTypes ?? ["ep_individual"]) f.append("serviceTypes", s);
  return f;
}

/** Ids que hi havia abans de començar: tot el que aparegui després es neteja. */
const abans = new Set(getStore().availability_rules.map((r) => r.id));

async function accepta(etiqueta: string, c: Camps) {
  const res = await submitAvailabilityRules(TRAINER, fd(c));
  if (!res.ok) fail(`${etiqueta}: s'havia d'acceptar i diu "${res.error}"`);
  else console.log(`  ✓ ${etiqueta}`);
}

async function rebutja(etiqueta: string, c: Camps, conte?: string) {
  const res = await submitAvailabilityRules(TRAINER, fd(c));
  if (res.ok) {
    fail(`${etiqueta}: s'havia de rebutjar i ha entrat`);
    return;
  }
  if (conte && !(res.error ?? "").toLowerCase().includes(conte.toLowerCase()))
    fail(`${etiqueta}: rebutjat, però el missatge no parla de "${conte}" — "${res.error}"`);
  else console.log(`  ✓ ${etiqueta} → "${res.error}"`);
}

// ───────────────── El que ha d'entrar ─────────────────

console.log("1. Franges vàlides");
await accepta("09:00–10:00 (en punt, com sempre)", { startTime: "09:00", endTime: "10:00" });
await accepta("09:30–10:30 (EL CAS DE LA LAIA)", { startTime: "09:30", endTime: "10:30" });
await accepta("09:30–13:30 (matí sencer començant a mitja hora)", { startTime: "09:30", endTime: "13:30" });
await accepta("diversos dies alhora", { startTime: "17:00", endTime: "20:00", weekdays: ["1", "2", "3"] });
await accepta("amb data de fi", { startTime: "08:00", endTime: "09:00", validUntil: "2027-01-01" });
await accepta("diversos serveis", {
  startTime: "07:00", endTime: "08:00",
  serviceTypes: ["ep_individual", "ep_parejas"],
});

// ───────────────── El que NO ha d'entrar ─────────────────

console.log("2. Hores fora de la graella de mitja hora");
await rebutja("09:15–10:15", { startTime: "09:15", endTime: "10:15" }, "mitja hora");
await rebutja("09:00–10:45", { startTime: "09:00", endTime: "10:45" }, "mitja hora");
await rebutja("09:01–10:01", { startTime: "09:01", endTime: "10:01" }, "mitja hora");

console.log("3. Hores que no són hores");
await rebutja("buit", { startTime: "", endTime: "10:00" }, "vàlida");
await rebutja("text", { startTime: "abc", endTime: "10:00" }, "vàlida");
await rebutja("25:00", { startTime: "25:00", endTime: "26:00" }, "vàlida");
await rebutja("9:30 sense zero", { startTime: "9:30", endTime: "10:30" }, "vàlida");
await rebutja("injecció SQL com a hora", { startTime: "09:00'; drop table x;--", endTime: "10:00" }, "vàlida");

console.log("4. Ordre i durada");
await rebutja("fi abans que inici", { startTime: "10:00", endTime: "09:00" }, "posterior");
await rebutja("fi igual que inici", { startTime: "10:00", endTime: "10:00" }, "posterior");
await rebutja("09:00–09:30, més curta que una sessió", { startTime: "09:00", endTime: "09:30" }, "mínim una sessió");

console.log("5. Dies i serveis");
await rebutja("cap dia marcat", { startTime: "09:00", endTime: "10:00", weekdays: [] }, "dia");
await rebutja("dia fora de rang", { startTime: "09:00", endTime: "10:00", weekdays: ["9"] }, "dia");
await rebutja("cap servei marcat", { startTime: "09:00", endTime: "10:00", serviceTypes: [] }, "servei");
await rebutja("servei inventat", { startTime: "09:00", endTime: "10:00", serviceTypes: ["massatge"] }, "servei");

console.log("6. Vigència");
await rebutja("data inexistent", { startTime: "09:00", endTime: "10:00", validFrom: "2026-02-31" }, "no existeix");
await rebutja("data mal formada", { startTime: "09:00", endTime: "10:00", validFrom: "31/02/2026" }, "vàlida");
await rebutja("fins a anterior a des de", {
  startTime: "09:00", endTime: "10:00",
  validFrom: "2026-06-01", validUntil: "2026-05-01",
}, "anterior");

// ───────────── El que s'ha desat és el que s'ha demanat ─────────────

console.log("7. El que entra es desa tal com s'ha escrit");
const laia = getStore().availability_rules.find(
  (r) => !abans.has(r.id) && r.start_time === "09:30" && r.end_time === "10:30",
);
if (!laia) fail("no s'ha trobat la franja 09:30–10:30 al magatzem");
else console.log(`  ✓ desada com ${laia.start_time}–${laia.end_time}, dia ${laia.weekday}`);

// ───────────────── L'edició valida igual ─────────────────

console.log("8. L'edició passa pel mateix sedàs");
if (laia) {
  const mal = await submitAvailabilityUpdate(
    fd({ id: laia.id, startTime: "09:15", endTime: "10:15" }),
  );
  if (mal.ok) fail("editar a 09:15 s'havia de rebutjar");
  else console.log(`  ✓ editar fora de graella → "${mal.error}"`);

  const be = await submitAvailabilityUpdate(
    fd({ id: laia.id, startTime: "10:00", endTime: "11:30" }),
  );
  if (!be.ok) fail(`editar a 10:00–11:30 s'havia d'acceptar i diu "${be.error}"`);
  else console.log("  ✓ editar a 10:00–11:30");

  const senseId = await submitAvailabilityUpdate(fd({ startTime: "10:00", endTime: "11:00" }));
  if (senseId.ok) fail("editar sense id s'havia de rebutjar");
  else console.log(`  ✓ editar sense id → "${senseId.error}"`);
}

// ─────────────────────────── Neteja ───────────────────────────

const store = getStore();
const creades = store.availability_rules.filter((r) => !abans.has(r.id));
store.availability_rules = store.availability_rules.filter((r) => abans.has(r.id));
saveStore(store);
console.log(`\nNetejades ${creades.length} franges de prova (per id exacte).`);

if (fallides > 0) {
  console.error(`✗ ${fallides} comprovacions fallides`);
  process.exit(1);
}
console.log("✓ La validació de servidor es té dreta.");
