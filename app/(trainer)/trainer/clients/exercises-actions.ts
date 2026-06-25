"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  assignExercise,
  removeClientExercise,
} from "@/lib/data/client-exercises";

/**
 * Asigna un ejercicio a un cliente (trainer). La RLS solo lo permite si es el
 * entrenador/a asignado del cliente.
 */
export async function assignExerciseTrainerAction(
  clientId: string,
  formData: FormData,
) {
  const viewer = await getViewer();
  if (!viewer) return;
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!exerciseId) return;
  await assignExercise({
    clientId,
    exerciseId,
    assignedBy: viewer.id,
    notes,
  });
  revalidatePath(`/trainer/clients/${clientId}`);
}

/** Elimina una asignación de ejercicio (trainer asignado, vía RLS). */
export async function removeExerciseTrainerAction(
  clientId: string,
  formData: FormData,
) {
  const id = String(formData.get("id") ?? "");
  if (id) await removeClientExercise(id);
  revalidatePath(`/trainer/clients/${clientId}`);
}
