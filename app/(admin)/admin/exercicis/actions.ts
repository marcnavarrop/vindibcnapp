"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createExercise,
  updateExercise,
  getExercise,
  deleteExercise,
  type ExerciseInput,
} from "@/lib/data/exercises";
import {
  uploadExerciseVideo,
  validateExerciseVideo,
} from "@/lib/data/exercise-videos";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ExerciseCategory } from "@/types/database";

async function parse(formData: FormData): Promise<{ input: ExerciseInput } | { error: string }> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const videoMode = str("videoMode"); // "url" | "file" | ""
  const videoUrl = videoMode === "url" ? str("videoUrl") || null : null;

  let videoFilePath: string | null = null;
  if (videoMode === "file") {
    const file = formData.get("videoFile");
    // Si no s'ha seleccionat fitxer nou però hi ha un path existent, el conservem
    const existingPath = str("existingVideoFilePath") || null;
    if (file instanceof File && file.size > 0) {
      const validation = validateExerciseVideo(file);
      if (!validation.ok) return { error: validation.error };
      // La pujada real es fa a createExerciseAction/updateExerciseAction
      // perquè necessitem l'id de l'exercici per al path.
      // Aquí retornem el File com a marcador — es passa per referència.
      // En realitat, uploadExerciseVideo es crida des de l'action.
      // Retornem null aquí i el caller s'encarrega.
      videoFilePath = null; // placeholder, el caller puja el fitxer
    } else {
      videoFilePath = existingPath;
    }
  }

  return {
    input: {
      name: str("name"),
      category: formData.get("category") as ExerciseCategory,
      description: str("description") || null,
      videoUrl,
      videoFilePath,
    },
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
  const parsed = await parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { input } = parsed;

  const err = validate(input);
  if (err) return { error: err };

  // Creem primer l'exercici per tenir l'id
  let exerciseId: string;
  try {
    exerciseId = await createExercise(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear." };
  }

  // Si hi ha vídeo nou, el pugem ara que tenim l'id
  const videoMode = String(formData.get("videoMode") ?? "");
  if (videoMode === "file") {
    const file = formData.get("videoFile");
    if (file instanceof File && file.size > 0) {
      try {
        const path = await uploadExerciseVideo(exerciseId, file);
        await updateExercise(exerciseId, { ...input, videoFilePath: path });
      } catch (e) {
        // L'exercici es crea igualment; l'error de vídeo no és bloquejant
        return { error: e instanceof Error ? e.message : "Error pujant el vídeo." };
      }
    }
  }

  revalidatePath("/admin/exercicis");
  redirect("/admin/exercicis");
}

export async function updateExerciseAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { input } = parsed;

  const err = validate(input);
  if (err) return { error: err };

  // Obtenim el path actual per saber si cal esborrar-lo
  const existing = await getExercise(id);
  const oldPath = existing?.videoFilePath ?? null;

  // Si hi ha fitxer nou, pugem primer
  const videoMode = String(formData.get("videoMode") ?? "");
  if (videoMode === "file") {
    const file = formData.get("videoFile");
    if (file instanceof File && file.size > 0) {
      try {
        const path = await uploadExerciseVideo(id, file);
        input.videoFilePath = path;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error pujant el vídeo." };
      }
    }
    // Si no hi ha fitxer nou, existingVideoFilePath ja ve del parse
  }

  try {
    await updateExercise(id, input, oldPath);
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
