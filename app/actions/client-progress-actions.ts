"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createExerciseProgress,
  deleteExerciseProgress,
} from "@/lib/data/exercise-progress";

export async function addProgressAction(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer")) return;

  const clientExerciseId = formData.get("clientExerciseId") as string;
  const recordedAt = (formData.get("recordedAt") as string) || new Date().toISOString().slice(0, 10);
  const weightKg = parseFloat(formData.get("weightKg") as string);
  const repsRaw = formData.get("reps") as string;
  const notes = (formData.get("notes") as string) || null;
  const redirectPath = formData.get("redirectPath") as string;

  if (!clientExerciseId || isNaN(weightKg)) return;

  await createExerciseProgress({
    clientExerciseId,
    recordedAt,
    weightKg,
    reps: repsRaw ? parseInt(repsRaw, 10) : null,
    notes,
    recordedBy: viewer.id,
  });

  revalidatePath(redirectPath ?? "/admin/clients");
}

export async function deleteProgressAction(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer")) return;

  const id = formData.get("id") as string;
  const redirectPath = formData.get("redirectPath") as string;
  if (!id) return;

  await deleteExerciseProgress(id);
  revalidatePath(redirectPath ?? "/admin/clients");
}
