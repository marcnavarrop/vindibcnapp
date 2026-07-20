"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMeasurement,
  deleteMeasurement,
} from "@/lib/data/measurements";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export async function createMeasurementTrainerAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const recordedAt = String(formData.get("recordedAt") ?? "");
  const weightRaw = String(formData.get("weightKg") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!recordedAt) return { error: "Indica la data." };
  const weightKg = weightRaw === "" ? null : Number(weightRaw);
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0))
    return { error: "El pes no és vàlid." };
  if (weightKg === null && !notes)
    return { error: "Indica almenys el pes o una nota." };

  try {
    await createMeasurement({ clientId, recordedAt, weightKg, notes });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }

  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}`);
}

export async function deleteMeasurementTrainerAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (id) await deleteMeasurement(id);
  if (clientId) revalidatePath(`/trainer/clients/${clientId}`);
}
