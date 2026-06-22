"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createExercise,
  updateExercise,
  deleteExercise,
  type ExerciseInput,
} from "@/lib/data/exercises";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ExerciseCategory } from "@/types/database";

function parse(formData: FormData): ExerciseInput {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    name: str("name"),
    category: formData.get("category") as ExerciseCategory,
    description: str("description") || null,
    videoUrl: str("videoUrl") || null,
  };
}

function validate(input: ExerciseInput): string | null {
  if (!input.name) return "El nom és obligatori.";
  if (!(input.category in EXERCISE_CATEGORY_LABELS))
    return "Tria una categoria.";
  return null;
}

export async function createExerciseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };
  try {
    await createExercise(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear." };
  }
  revalidatePath("/admin/exercicis");
  redirect("/admin/exercicis");
}

export async function updateExerciseAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };
  try {
    await updateExercise(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }
  revalidatePath("/admin/exercicis");
  redirect("/admin/exercicis");
}

export async function deleteExerciseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteExercise(id);
  revalidatePath("/admin/exercicis");
}
