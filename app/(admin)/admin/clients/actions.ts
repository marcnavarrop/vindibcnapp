"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClientRecord,
  updateClientRecord,
  type ClientInput,
} from "@/lib/data/clients";
import { markTrialConverted } from "@/lib/data/trial-bookings";

export type FormState = { error?: string };

function parse(formData: FormData): ClientInput {
  const str = (k: string) =>
    ((formData.get(k) as string | null) ?? "").trim();
  return {
    fullName: str("fullName"),
    email: str("email"),
    phone: str("phone") || null,
    assignedTrainerId: str("assignedTrainerId") || null,
    notes: str("notes") || null,
  };
}

function validate(input: ClientInput): string | null {
  if (!input.fullName) return "El nom és obligatori.";
  if (!input.email) return "El correu electrònic és obligatori.";
  return null;
}

export async function createClientAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };

  let id: string;
  try {
    id = await createClientRecord(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear." };
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
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };

  try {
    await updateClientRecord(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  redirect(`/admin/clients/${id}`);
}
