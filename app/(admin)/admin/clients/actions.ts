"use server";

import { requireRole } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClientRecord,
  updateClientRecord,
  type ClientInput,
} from "@/lib/data/clients";
import { markTrialConverted } from "@/lib/data/trial-bookings";
import { EmailTakenError } from "@/lib/data/account-email";

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
