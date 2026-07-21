import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import type { ExerciseCategory } from "@/types/database";

export type AssignedExercise = {
  id: string; // id de la asignación (client_exercises.id)
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  description: string | null;
  videoUrl: string | null;
  videoFilePath: string | null;
  notes: string | null;
  assignedAt: string;
};

/** Ejercicios asignados a un cliente (con las notas del entrenador/a). */
export async function listClientExercises(
  clientId: string,
): Promise<AssignedExercise[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.client_exercises
      .filter((ce) => ce.client_id === clientId)
      .map((ce) => {
        const ex = store.exercises.find((e) => e.id === ce.exercise_id);
        return {
          id: ce.id,
          exerciseId: ce.exercise_id,
          name: ex?.name ?? "—",
          category: (ex?.category ?? "forca") as ExerciseCategory,
          description: ex?.description ?? null,
          videoUrl: ex?.video_url ?? null,
          videoFilePath: ex?.video_file_path ?? null,
          notes: ce.notes,
          assignedAt: ce.assigned_at,
        };
      })
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_exercises")
    .select(
      `id, exercise_id, notes, assigned_at,
       exercise:exercises!client_exercises_exercise_id_fkey(name, category, description, video_url, video_file_path)`,
    )
    .eq("client_id", clientId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    exercise_id: string;
    notes: string | null;
    assigned_at: string;
    exercise: {
      name: string;
      category: ExerciseCategory;
      description: string | null;
      video_url: string | null;
      video_file_path: string | null;
    } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    name: r.exercise?.name ?? "—",
    category: r.exercise?.category ?? "forca",
    description: r.exercise?.description ?? null,
    videoUrl: r.exercise?.video_url ?? null,
    videoFilePath: r.exercise?.video_file_path ?? null,
    notes: r.notes,
    assignedAt: r.assigned_at,
  }));
}

export type AssignExerciseInput = {
  clientId: string;
  exerciseId: string;
  assignedBy: string;
  notes: string | null;
};

/**
 * Asigna un ejercicio a un cliente. La escritura va con el cliente del usuario
 * (RLS): la policy permite admin o el entrenador/a asignado del cliente.
 */
export async function assignExercise(input: AssignExerciseInput): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.client_exercises.push({
      id: crypto.randomUUID(),
      client_id: input.clientId,
      exercise_id: input.exerciseId,
      assigned_by: input.assignedBy,
      notes: input.notes,
      assigned_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("client_exercises").insert({
    client_id: input.clientId,
    exercise_id: input.exerciseId,
    assigned_by: input.assignedBy,
    notes: input.notes,
  });
  if (error) throw error;
}

/** Elimina una asignación (admin o entrenador/a asignado, vía RLS). */
export async function removeClientExercise(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.client_exercises = store.client_exercises.filter((ce) => ce.id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_exercises")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
