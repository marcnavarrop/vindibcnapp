"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  assignExercise,
  createWorkoutDay,
  deleteWorkoutDay,
  duplicateWorkoutDay,
  moveClientExercise,
  removeClientExercise,
  renameWorkoutDay,
  reorderClientExercises,
  reorderWorkoutDays,
  updateExercisePauta,
} from "@/lib/data/client-exercises";
import { parseDayName, parsePauta, PAUTA_MAX } from "@/lib/workout-pauta";

/**
 * La pauta per dies d'un client (0112), des de la fitxa: admin i professional.
 *
 * Totes miren el rol a la primera línia (`requireRole`), però QUI pot tocar
 * QUIN client no ho decideixen aquí: va amb la sessió i ho decideix la RLS de
 * la 0112 (admin, o el professional ASSIGNAT; mai demo amb real). Si no hi té
 * permís, la base no troba la fila o rebutja l'escriptura, i aquí es tradueix a
 * un missatge.
 *
 * Retornen un estat (`{ ok }` o `{ error }`) en comptes de llançar: els botons
 * de la fitxa l'ensenyen al costat, sense pantalla d'error.
 */

export type PlanResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidate(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/client/exercicis");
}

/** Error de la base → frase per a la fitxa. */
function explain(e: unknown, fallback: string): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "42501") return "No tens permís per canviar la pauta d'aquest client.";
  if (err?.code === "P0002") return "Això ja no existeix: torna a carregar la fitxa.";
  if (err?.code === "22023") return "La fitxa no estava al dia: torna-la a carregar i prova-ho de nou.";
  if (err?.code === "23514") return "Aquest dia no és d'aquest client.";
  console.error("[pauta]", fallback, e);
  return fallback;
}

const NAME_TOO_LONG = `El nom del dia pot tenir com a molt ${PAUTA_MAX.name} caràcters.`;

// ─── Exercicis ──────────────────────────────────────────────────────────────

/** Assigna un exercici al dia obert (o a «Sense dia»), amb la pauta. */
export async function assignPlanExerciseAction(
  clientId: string,
  _prev: PlanResult | null,
  formData: FormData,
): Promise<PlanResult> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return { ok: false, error: "No autoritzat." };
  const exerciseId = String(formData.get("exerciseId") ?? "");
  if (!exerciseId) return { ok: false, error: "Tria un exercici." };
  const dayId = String(formData.get("dayId") ?? "") || null;
  const pauta = parsePauta(formData);
  if (!pauta.ok) return pauta;
  try {
    await assignExercise({ clientId, exerciseId, assignedBy: viewer.id, dayId, ...pauta.value });
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut assignar l'exercici.") };
  }
  revalidate(clientId);
  return { ok: true };
}

/** Desa la pauta i les notes d'un exercici. */
export async function updatePautaAction(
  clientId: string,
  id: string,
  _prev: PlanResult | null,
  formData: FormData,
): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  const pauta = parsePauta(formData);
  if (!pauta.ok) return pauta;
  try {
    await updateExercisePauta(id, pauta.value);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut desar la pauta.") };
  }
  revalidate(clientId);
  return { ok: true };
}

/** Treu un exercici (i el seu progrés: penja de l'assignació). */
export async function removePlanExerciseAction(clientId: string, formData: FormData): Promise<void> {
  if (!(await requireRole("admin", "trainer"))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await removeClientExercise(id);
  revalidate(clientId);
}

/** Mou un exercici a un altre dia (null = «Sense dia»). Conserva el progrés. */
export async function movePlanExerciseAction(
  clientId: string,
  id: string,
  dayId: string | null,
): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await moveClientExercise(id, dayId);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut moure l'exercici.") };
  }
  revalidate(clientId);
  return { ok: true };
}

/** Nou ordre dels exercicis d'un dia: la llista sencera. */
export async function reorderPlanExercisesAction(
  clientId: string,
  dayId: string | null,
  ids: string[],
): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await reorderClientExercises(clientId, dayId, ids);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut canviar l'ordre.") };
  }
  revalidate(clientId);
  return { ok: true };
}

// ─── Dies ───────────────────────────────────────────────────────────────────

export async function createDayAction(clientId: string, name: string): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  const parsed = parseDayName(name);
  if (parsed === undefined) return { ok: false, error: NAME_TOO_LONG };
  try {
    const id = await createWorkoutDay(clientId, parsed);
    revalidate(clientId);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut crear el dia.") };
  }
}

export async function renameDayAction(clientId: string, dayId: string, name: string): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  const parsed = parseDayName(name);
  if (parsed === undefined) return { ok: false, error: NAME_TOO_LONG };
  try {
    await renameWorkoutDay(dayId, parsed);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut reanomenar el dia.") };
  }
  revalidate(clientId);
  return { ok: true };
}

/** Esborra el dia: els seus exercicis passen a «Sense dia», mai s'esborren. */
export async function deleteDayAction(clientId: string, dayId: string): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await deleteWorkoutDay(dayId);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut esborrar el dia.") };
  }
  revalidate(clientId);
  return { ok: true };
}

export async function duplicateDayAction(clientId: string, dayId: string): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    const id = await duplicateWorkoutDay(dayId);
    revalidate(clientId);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut duplicar el dia.") };
  }
}

/** Nou ordre dels dies: la llista sencera. */
export async function reorderDaysAction(clientId: string, ids: string[]): Promise<PlanResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await reorderWorkoutDays(clientId, ids);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut canviar l'ordre dels dies.") };
  }
  revalidate(clientId);
  return { ok: true };
}
