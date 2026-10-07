"use server";

import { requireRole } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  appendGeneralNote,
  createClientRecord,
  updateClientRecord,
  type ClientInput,
} from "@/lib/data/clients";
import { markTrialConverted } from "@/lib/data/trial-bookings";
import { EmailTakenError } from "@/lib/data/account-email";
import { centerToday } from "@/lib/center-time";

export type FormState = {
  error?: string;
  /** El correu ja és d'aquest client: la pantalla hi enllaça. */
  existingClientId?: string;
  /**
   * El que s'havia escrit, quan hi ha error. React 19 buida el formulari en
   * acabar l'acció; sense això, un correu repetit obligava a tornar a escriure
   * el nom, el telèfon i les notes.
   */
  values?: Record<string, string>;
  /** Marca de cada error, perquè el formulari es torni a muntar amb `values`. */
  at?: number;
};

const FIELDS = ["fullName", "email", "phone", "assignedTrainerId", "clinicalNotes", "generalNotes"];

/** L'error, amb el que s'havia escrit perquè el formulari no es buidi. */
function fail(formData: FormData, error: string, extra: Partial<FormState> = {}): FormState {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  return { error, values, at: Date.now(), ...extra };
}

function parse(formData: FormData): ClientInput {
  const str = (k: string) =>
    ((formData.get(k) as string | null) ?? "").trim();
  return {
    fullName: str("fullName"),
    email: str("email"),
    phone: str("phone") || null,
    assignedTrainerId: str("assignedTrainerId") || null,
    clinicalNotes: str("clinicalNotes") || null,
    generalNotes: str("generalNotes") || null,
  };
}

/**
 * `requireEmail` només a l'alta. A l'edició el camp va `disabled` i, per tant,
 * no arriba al FormData: exigir-lo hauria fet impossible desar la fitxa.
 */
function validate(input: ClientInput, requireEmail: boolean): string | null {
  if (!input.fullName) return "El nom és obligatori.";
  if (requireEmail && !input.email) return "El correu electrònic és obligatori.";
  return null;
}

export async function createClientAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Només l'admin (cap pantalla de professional dona d'alta clients): crea el
  // compte i envia la invitació amb la clau de servei.
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };
  const input = parse(formData);
  const error = validate(input, true);
  if (error) return fail(formData, error);

  let id: string;
  try {
    id = await createClientRecord(input);
  } catch (e) {
    if (e instanceof EmailTakenError)
      return fail(formData, e.message, { existingClientId: e.existingClientId ?? undefined });
    return fail(formData, e instanceof Error ? e.message : "Error en crear.");
  }

  // Si prové de convertir una sessió de prova, la vinculem (converted_client_id).
  const trialId = String(formData.get("trialId") ?? "");
  if (trialId) {
    try {
      await markTrialConverted(trialId, id);
    } catch {
      // La conversió del client ja s'ha fet; el vincle és secundari.
    }
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${id}`);
}

export async function updateClientAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireRole("admin"))) return { error: "No autoritzat." };
  const input = parse(formData);
  const error = validate(input, false);
  if (error) return fail(formData, error);

  try {
    // Camp a camp i no `...input`: `email` es queda fora encara que arribi al
    // FormData —un POST a mà el pot portar, el `disabled` de la pantalla no és
    // cap barrera—, i si un dia s'afegeix un camp nou a `ClientUpdateInput`,
    // oblidar-lo aquí no compila.
    await updateClientRecord(id, {
      fullName: input.fullName,
      phone: input.phone,
      assignedTrainerId: input.assignedTrainerId,
      clinicalNotes: input.clinicalNotes,
      generalNotes: input.generalNotes,
    });
  } catch (e) {
    return fail(formData, e instanceof Error ? e.message : "Error en desar.");
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  redirect(`/admin/clients/${id}`);
}

export type QuickNoteState = { error?: string; savedAt?: number };

/** El sostre d'una nota ràpida: una línia, no un informe. */
const QUICK_NOTE_MAX = 500;

/**
 * La nota ràpida del Resum de la fitxa: una línia nova al final de les notes
 * generals, amb la data del centre i qui l'escriu. Només l'admin (les notes
 * del client les edita l'administració; el professional les llegeix).
 */
export async function addGeneralNoteAction(
  clientId: string,
  _prev: QuickNoteState,
  formData: FormData,
): Promise<QuickNoteState> {
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };
  // Una sola línia: els salts de línia separen notes, no frases d'una nota.
  const text = String(formData.get("note") ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { error: "Escriu la nota abans de desar-la." };
  if (text.length > QUICK_NOTE_MAX)
    return { error: `Massa llarga: com a molt ${QUICK_NOTE_MAX} caràcters. Per a més, «Editar».` };

  const [y, m, d] = centerToday().split("-");
  const who = viewer.fullName.trim().split(/\s+/)[0] || "Administració";
  try {
    await appendGeneralNote(clientId, `${d}/${m}/${y} · ${who} · ${text}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No s'ha pogut desar la nota." };
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return { savedAt: Date.now() };
}
