"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createExerciseCategory,
  deleteExerciseCategory,
} from "@/lib/data/exercise-categories";

/**
 * Categories d'exercici: les mantenen els mateixos que mantenen la
 * biblioteca. La RLS de la 0057 ho torna a comprovar; aquí es fa per poder
 * respondre amb un missatge en comptes d'un error de política.
 */
async function assertCanManage(): Promise<string | null> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return "No autoritzat.";
  return null;
}

export type CategoryFormState = {
  error?: string;
  /** La categoria acabada de crear, perquè el formulari la pugui seleccionar. */
  created?: { id: string; name: string };
};

export async function createExerciseCategoryAction(
  basePath: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const denied = await assertCanManage();
  if (denied) return { error: denied };

  const result = await createExerciseCategory(String(formData.get("name") ?? ""));
  if (!result.ok) return { error: result.error };

  revalidatePath(basePath);
  return { created: { id: result.id, name: result.name } };
}

export async function deleteExerciseCategoryAction(
  basePath: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const denied = await assertCanManage();
  if (denied) return { error: denied };

  const result = await deleteExerciseCategory(String(formData.get("id") ?? ""));
  if (!result.ok) return { error: result.error };

  revalidatePath(basePath);
  return {};
}
