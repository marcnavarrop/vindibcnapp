/**
 * La pauta per dies (0112): dies, ordre, «Moure a…», duplicar, esborrar i
 * «Dia fet», en simulació.
 *
 *   npm run workout:check
 *
 * Treballa amb un fitxer de simulació PROPI en una carpeta temporal nova (no
 * toca el de `npm run dev`) i prova la capa de dades (`lib/data/client-exercises`)
 * i les regles pures (`lib/workout-pauta`):
 *
 *   · un fitxer d'abans de la 0112 (exercicis sense dia ni ordre) es llegeix bé
 *     i tot va a «Sense dia»;
 *   · dies: crear, numerar per ordre, reanomenar, reordenar;
 *   · un exercici nou va al final del seu dia; el mateix exercici, a dos dies;
 *   · MOURE CONSERVA EL PROGRÉS (és el mateix exercici, no un de nou), i no es
 *     pot moure a un dia d'un altre client;
 *   · reordenar amb una llista incompleta es rebutja;
 *   · duplicar copia exercicis, pauta i ordre, i NO el progrés;
 *   · ESBORRAR UN DIA NO ESBORRA CAP EXERCICI: passen a «Sense dia», en ordre i
 *     amb el progrés; el «dia fet» es queda amb la foto del dia;
 *   · «dia fet»: avui, un cop per dia (el segon és «ja fet»), i es desfà;
 *   · el dia que toca, en cicle; i la validació de la pauta.
 *
 * Les regles de QUI pot fer-ho són de la RLS (0112) i es proven al SQL Editor.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.NEXT_PUBLIC_USE_MOCK = "true";
process.env.TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "vindi-workout-"));
const STORE = path.join(os.tmpdir(), "vindibcn-mock.json");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
async function throws(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

const { getStore, saveStore } = await import("../lib/mock/store");
const data = await import("../lib/data/client-exercises");
const { parsePauta, parseDayName, nextWorkoutDayId, formatRest, moveInList } = await import("../lib/workout-pauta");
const { centerToday } = await import("../lib/center-time");

check(os.tmpdir() !== "/tmp" && !fs.existsSync(STORE), "fitxer de simulació propi, encara buit");

// Un fitxer «d'abans»: l'exercici de l'Ana sense cap camp nou.
{
  const s = getStore();
  s.client_exercises = s.client_exercises.map((ce) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { day_id, position, sets, reps, load, rest_seconds, ...old } = ce;
    return old as typeof ce;
  });
  saveStore(s);
}
const ANA = "c-ana";
const MARTA = "c-marta";

console.log("\nUn fitxer d'abans de la 0112");
let plan = await data.getWorkoutPlan(ANA);
check(plan.days.length === 0 && plan.exercises.length === 1, "cap dia, un exercici");
check(plan.exercises[0].dayId === null && plan.exercises[0].sets === null, "…a «Sense dia» i sense pauta");
const CE1 = plan.exercises[0].id;
const progress = () => getStore().exercise_progress.filter((p) => p.client_exercise_id === CE1).length;
const P0 = progress();
check(P0 === 2, "…amb 2 registres de progrés");

console.log("\nDies");
const d1 = await data.createWorkoutDay(ANA, "Cames");
const d2 = await data.createWorkoutDay(ANA, null);
plan = await data.getWorkoutPlan(ANA);
check(plan.days.map((d) => `${d.number}:${d.name}`).join() === "1:Cames,2:null", "«Dia 1 · Cames» i «Dia 2»");
await data.renameWorkoutDay(d2, "Tors");
plan = await data.getWorkoutPlan(ANA);
check(plan.days[1].name === "Tors", "reanomenar");
await data.reorderWorkoutDays(ANA, [d2, d1]);
plan = await data.getWorkoutPlan(ANA);
check(plan.days.map((d) => d.name).join() === "Tors,Cames" && plan.days[0].number === 1, "reordenar: «Tors» passa a ser el Dia 1");
check(await throws(() => data.reorderWorkoutDays(ANA, [d1])), "reordenar dies amb una llista incompleta: rebutjat");

console.log("\nExercicis i pauta");
await data.assignExercise({ clientId: ANA, exerciseId: "e-planxa", assignedBy: "u-trainer-laia", dayId: d1, sets: 3, reps: "30 s", load: null, restSeconds: 45, notes: null });
await data.assignExercise({ clientId: ANA, exerciseId: "e-esquat", assignedBy: "u-trainer-laia", dayId: d1, sets: 4, reps: "8-10", load: "RPE 7", restSeconds: 90, notes: "Esquena recta" });
await data.assignExercise({ clientId: ANA, exerciseId: "e-esquat", assignedBy: "u-trainer-laia", dayId: d2, sets: null, reps: null, load: null, restSeconds: null, notes: null });
plan = await data.getWorkoutPlan(ANA);
const inD1 = () => plan.exercises.filter((e) => e.dayId === d1);
check(inD1().map((e) => e.exerciseId).join() === "e-planxa,e-esquat" && inD1()[1].position > inD1()[0].position, "un exercici nou va al final del seu dia");
check(plan.exercises.filter((e) => e.exerciseId === "e-esquat").length === 3, "el mateix exercici pot ser a més d'un dia");
check(inD1()[1].load === "RPE 7" && inD1()[1].restSeconds === 90, "…amb la seva pauta");
check(
  await throws(() => data.assignExercise({ clientId: MARTA, exerciseId: "e-planxa", assignedBy: "u-admin", dayId: d1, sets: null, reps: null, load: null, restSeconds: null, notes: null })),
  "assignar a un altre client un dia de l'Ana: rebutjat",
);
await data.updateExercisePauta(inD1()[0].id, { sets: 2, reps: "45 s", load: null, restSeconds: 60, notes: "Cos alineat" });
plan = await data.getWorkoutPlan(ANA);
check(inD1()[0].reps === "45 s" && inD1()[0].notes === "Cos alineat", "editar la pauta i les notes");

console.log("\nMoure conserva el progrés");
await data.moveClientExercise(CE1, d1);
plan = await data.getWorkoutPlan(ANA);
const moved = plan.exercises.find((e) => e.id === CE1)!;
check(moved.dayId === d1, "l'esquat de «Sense dia» passa a «Cames»…");
check(moved.position > Math.max(...inD1().filter((e) => e.id !== CE1).map((e) => e.position)), "…al final del dia…");
check(progress() === P0, "…i és el MATEIX exercici: conserva els seus registres de progrés");
const martaDay = await data.createWorkoutDay(MARTA, null);
check(await throws(() => data.moveClientExercise(CE1, martaDay)), "moure'l a un dia d'un altre client: rebutjat");

console.log("\nReordenar exercicis");
const ids = inD1().map((e) => e.id);
await data.reorderClientExercises(ANA, d1, [...ids].reverse());
plan = await data.getWorkoutPlan(ANA);
check(inD1().map((e) => e.id).join() === [...ids].reverse().join(), "l'ordre queda canviat");
check(await throws(() => data.reorderClientExercises(ANA, d1, ids.slice(1))), "amb una llista incompleta: rebutjat");

console.log("\nDuplicar");
const order = inD1().map((e) => `${e.exerciseId}|${e.sets}|${e.reps}|${e.load}|${e.restSeconds}|${e.notes}`);
const copy = await data.duplicateWorkoutDay(d1);
plan = await data.getWorkoutPlan(ANA);
const copied = plan.exercises.filter((e) => e.dayId === copy);
check(plan.days.at(-1)?.id === copy && plan.days.at(-1)?.name === "Cames (còpia)", "«Cames (còpia)» al final");
check(copied.map((e) => `${e.exerciseId}|${e.sets}|${e.reps}|${e.load}|${e.restSeconds}|${e.notes}`).join() === order.join(), "mateixos exercicis, pauta i ordre");
check(getStore().exercise_progress.filter((p) => copied.some((e) => e.id === p.client_exercise_id)).length === 0, "sense copiar el progrés");

console.log("\n«Dia fet»");
const today = centerToday();
await data.markWorkoutDayDone(ANA, d1, "u-client-ana");
plan = await data.getWorkoutPlan(ANA);
check(plan.logs.length === 1 && plan.logs[0].doneOn === today, "marcat avui");
check(plan.logs[0].dayName === "Cames" && plan.logs[0].dayNumber === 2, "…amb la foto del dia (Cames, número 2)");
let already = false;
try {
  await data.markWorkoutDayDone(ANA, d1, "u-client-ana");
} catch (e) {
  already = e instanceof data.AlreadyDoneError;
}
check(already, "el segon cop el mateix dia és «ja fet», no un altre registre");
check(await throws(() => data.markWorkoutDayDone(ANA, martaDay, "u-client-ana")), "marcar un dia d'un altre client: rebutjat");
await data.unmarkWorkoutDayDone(ANA, d1);
check((await data.getWorkoutPlan(ANA)).logs.length === 0, "desfer el d'avui");
await data.markWorkoutDayDone(ANA, d1, "u-client-ana");

console.log("\nEsborrar un dia no esborra cap exercici");
const before = getStore().client_exercises.filter((c) => c.client_id === ANA).length;
plan = await data.getWorkoutPlan(ANA);
const goingNames = inD1().map((e) => e.id);
await data.deleteWorkoutDay(d1);
plan = await data.getWorkoutPlan(ANA);
const none = plan.exercises.filter((e) => e.dayId === null);
check(getStore().client_exercises.filter((c) => c.client_id === ANA).length === before, "cap exercici esborrat");
check(none.map((e) => e.id).join() === goingNames.join(), "passen a «Sense dia», en el mateix ordre");
check(progress() === P0, "l'esquat conserva el progrés");
check(plan.logs[0]?.dayId === null && plan.logs[0]?.dayName === "Cames", "el «dia fet» es queda, amb la foto del dia");
check(plan.days.map((d) => d.number).join() === "1,2", "els dies que queden es tornen a numerar (1, 2)");

console.log("\nEl dia que toca");
const D = [{ id: "a" }, { id: "b" }, { id: "c" }];
check(nextWorkoutDayId(D, [], today) === "a", "sense cap «dia fet», el primer");
check(nextWorkoutDayId(D, [{ dayId: "a", doneOn: "2026-01-01" }], today) === "b", "després del Dia 1, el Dia 2");
check(nextWorkoutDayId(D, [{ dayId: "c", doneOn: "2026-01-01" }], today) === "a", "després de l'últim, torna al primer");
check(nextWorkoutDayId(D, [{ dayId: "b", doneOn: today }], today) === "b", "si avui ja n'ha fet un, toca encara aquell");
check(nextWorkoutDayId(D, [{ dayId: null, doneOn: today }, { dayId: "a", doneOn: "2026-01-01" }], today) === "b", "un «dia fet» d'un dia esborrat no compta");
check(nextWorkoutDayId([], [], today) === null, "sense dies, cap");

console.log("\nLa pauta");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const ok = parsePauta(fd({ sets: "3", reps: " 8-10 ", load: "RPE  7", restSeconds: "90", notes: "  " }));
check(ok.ok && ok.value.sets === 3 && ok.value.reps === "8-10" && ok.value.load === "RPE 7" && ok.value.notes === null, "valors bons, espais netejats, notes buides = cap");
check(parsePauta(fd({})).ok, "tot buit és vàlid (tot opcional)");
check(!parsePauta(fd({ sets: "0" })).ok && !parsePauta(fd({ sets: "100" })).ok && !parsePauta(fd({ sets: "3.5" })).ok, "sèries fora de 1-99 o amb decimals: rebutjat");
check(!parsePauta(fd({ restSeconds: "3601" })).ok && !parsePauta(fd({ restSeconds: "-5" })).ok, "descans fora de 0-3600: rebutjat");
check(!parsePauta(fd({ reps: "x".repeat(21) })).ok && !parsePauta(fd({ load: "x".repeat(31) })).ok, "reps > 20 o càrrega > 30 caràcters: rebutjat");
check(parseDayName("  ") === null && parseDayName("x".repeat(41)) === undefined && parseDayName(" Cames ") === "Cames", "nom del dia: buit = cap, > 40 rebutjat");
check(formatRest(45) === "45 s" && formatRest(120) === "2 min" && formatRest(90) === "1 min 30 s", "el descans es llegeix en minuts quan cal");
check(moveInList([1, 2, 3], 0, -1) === null && moveInList([1, 2, 3], 1, 1)?.join() === "1,3,2", "↑↓ a la vora no fan res");

fs.rmSync(process.env.TMPDIR!, { recursive: true, force: true });
console.log(fallides ? `\n${fallides} comprovacions fallides` : "\nTot correcte");
process.exit(fallides ? 1 : 0);
