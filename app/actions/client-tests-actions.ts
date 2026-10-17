"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { centerToday } from "@/lib/center-time";
import { parseEntry, parseTest } from "@/lib/client-tests";
import {
  addTestEntry,
  canCreateClientTests,
  createClientTest,
  deleteClientTest,
  deleteTestEntry,
  reorderClientTests,
  updateClientTest,
  updateTestEntry,
} from "@/lib/data/client-tests";

/**
 * Els tests d'avaluació d'un client (0113), des de la fitxa: admin i
 * professional.
 *
 * Totes miren el rol a la primera línia (`requireRole`), però QUI pot tocar
 * QUIN client no ho decideixen aquí: va amb la sessió i ho decideix la RLS de
 * la 0113 (admin, o el professional ASSIGNAT; mai demo amb real). Si no hi té
 * permís, la base no troba la fila o rebutja l'escriptura, i aquí es tradueix a
 * un missatge.
 *
 * Retornen un estat (`{ ok }` o `{ error }`) en comptes de llançar: la fitxa
 * l'ensenya al costat del formulari.
 */

export type TestResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidate(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/client/exercicis");
}

const NO_CONSENT =
  "Aquest client no té signat el consentiment de dades de salut vigent (versió 2026-10). Fins que no l'accepti des de la seva àrea, no s'hi poden afegir tests ni registres.";

/**
 * En crear, un 42501 pot ser falta de permís o falta del consentiment de salut
 * (0117): es pregunta quin dels dos per dir-ho bé.
 */
async function explainCreate(e: unknown, clientId: string, fallback: string): Promise<string> {
  if ((e as { code?: string })?.code === "42501" && !(await canCreateClientTests(clientId).catch(() => true)))
    return NO_CONSENT;
  return explain(e, fallback);
}

/** Error de la base → frase per a la fitxa. */
function explain(e: unknown, fallback: string): string {
  const err = e as { code?: string };
  if (err?.code === "42501") return "No tens permís per canviar els tests d'aquest client.";
  if (err?.code === "23505") return "Aquest client ja té un test amb aquest títol.";
  if (err?.code === "23514") return "La data no pot ser futura.";
  if (err?.code === "P0002") return "Això ja no existeix: torna a carregar la fitxa.";
  if (err?.code === "22023") return "La fitxa no estava al dia: torna-la a carregar i prova-ho de nou.";
  console.error("[tests]", fallback, e);
  return fallback;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

export async function createTestAction(
  clientId: string,
  _prev: TestResult | null,
  formData: FormData,
): Promise<TestResult> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return { ok: false, error: "No autoritzat." };
  const parsed = parseTest(formData);
  if (!parsed.ok) return parsed;
  try {
    const id = await createClientTest(clientId, parsed.value, viewer.id);
    revalidate(clientId);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: await explainCreate(e, clientId, "No s'ha pogut crear el test.") };
  }
}

export async function updateTestAction(
  clientId: string,
  testId: string,
  _prev: TestResult | null,
  formData: FormData,
): Promise<TestResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  const parsed = parseTest(formData);
  if (!parsed.ok) return parsed;
  try {
    await updateClientTest(testId, parsed.value);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut desar el test.") };
  }
  revalidate(clientId);
  return { ok: true };
}

/** Esborra el test amb tots els seus registres. */
export async function deleteTestAction(clientId: string, testId: string): Promise<TestResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await deleteClientTest(testId);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut esborrar el test.") };
  }
  revalidate(clientId);
  return { ok: true };
}

/** Nou ordre dels tests: la llista sencera. */
export async function reorderTestsAction(clientId: string, ids: string[]): Promise<TestResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await reorderClientTests(clientId, ids);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut canviar l'ordre.") };
  }
  revalidate(clientId);
  return { ok: true };
}

// ─── Registres ──────────────────────────────────────────────────────────────

export async function addEntryAction(
  clientId: string,
  testId: string,
  _prev: TestResult | null,
  formData: FormData,
): Promise<TestResult> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return { ok: false, error: "No autoritzat." };
  const parsed = parseEntry(formData, centerToday());
  if (!parsed.ok) return parsed;
  try {
    await addTestEntry(testId, parsed.value, viewer.id);
  } catch (e) {
    return { ok: false, error: await explainCreate(e, clientId, "No s'ha pogut desar el registre.") };
  }
  revalidate(clientId);
  return { ok: true };
}

export async function updateEntryAction(
  clientId: string,
  entryId: string,
  _prev: TestResult | null,
  formData: FormData,
): Promise<TestResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  const parsed = parseEntry(formData, centerToday());
  if (!parsed.ok) return parsed;
  try {
    await updateTestEntry(entryId, parsed.value);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut desar el registre.") };
  }
  revalidate(clientId);
  return { ok: true };
}

export async function deleteEntryAction(clientId: string, entryId: string): Promise<TestResult> {
  if (!(await requireRole("admin", "trainer"))) return { ok: false, error: "No autoritzat." };
  try {
    await deleteTestEntry(entryId);
  } catch (e) {
    return { ok: false, error: explain(e, "No s'ha pogut esborrar el registre.") };
  }
  revalidate(clientId);
  return { ok: true };
}
