"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  assignExercise,
  removeClientExercise,
} from "@/lib/data/client-exercises";

/** Asigna un ejercicio a un cliente (admin). */
export async function assignExerciseAction(
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
  revalidatePath(`/admin/clients/${clientId}`);
}

/** Elimina una asignación de ejercicio (admin). */
export async function removeExerciseAction(
  clientId: string,
  formData: FormData,
) {
  const id = String(formData.get("id") ?? "");
  if (id) await removeClientExercise(id);
  revalidatePath(`/admin/clients/${clientId}`);
}
