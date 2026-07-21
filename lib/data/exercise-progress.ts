import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";

export type ExerciseProgressEntry = {
  id: string;
  clientExerciseId: string;
  recordedAt: string;
  weightKg: number;
  reps: number | null;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
};

export type ExerciseProgressInput = {
  clientExerciseId: string;
  recordedAt: string;
  weightKg: number;
  reps: number | null;
  notes: string | null;
  recordedBy: string;
};

type Row = {
  id: string;
  client_exercise_id: string;
  recorded_at: string;
  weight_kg: number;
  reps: number | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
};

function toEntry(r: Row): ExerciseProgressEntry {
  return {
    id: r.id,
    clientExerciseId: r.client_exercise_id,
    recordedAt: r.recorded_at,
    weightKg: Number(r.weight_kg),
    reps: r.reps,
    notes: r.notes,
    recordedBy: r.recorded_by,
    createdAt: r.created_at,
  };
}

/** Tots els registres de progrés d'una assignació concreta, de més recent a més antic. */
export async function listExerciseProgress(
  clientExerciseId: string,
): Promise<ExerciseProgressEntry[]> {
  if (USE_MOCK) {
    return (getStore().exercise_progress ?? [])
      .filter((r) => r.client_exercise_id === clientExerciseId)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .map(toEntry);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_progress")
    .select("*")
    .eq("client_exercise_id", clientExerciseId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

/** Progrés de tots els exercicis assignats a un client (per a la vista completa). */
export async function listAllProgressForClient(
  clientId: string,
): Promise<ExerciseProgressEntry[]> {
  if (USE_MOCK) {
    const store = getStore();
    const ceIds = new Set(
      store.client_exercises
        .filter((ce) => ce.client_id === clientId)
        .map((ce) => ce.id),
    );
    return (store.exercise_progress ?? [])
      .filter((r) => ceIds.has(r.client_exercise_id))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .map(toEntry);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_progress")
    .select("*, client_exercise:client_exercises!inner(client_id)")
    .eq("client_exercise.client_id", clientId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toEntry(r as unknown as Row));
}

export async function createExerciseProgress(
  input: ExerciseProgressInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    if (!store.exercise_progress) store.exercise_progress = [];
    store.exercise_progress.push({
      id: crypto.randomUUID(),
      client_exercise_id: input.clientExerciseId,
      recorded_at: input.recordedAt,
      weight_kg: input.weightKg,
      reps: input.reps,
      notes: input.notes,
      recorded_by: input.recordedBy,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exercise_progress").insert({
    client_exercise_id: input.clientExerciseId,
    recorded_at: input.recordedAt,
    weight_kg: input.weightKg,
    reps: input.reps,
    notes: input.notes,
    recorded_by: input.recordedBy,
  });
  if (error) throw error;
}

export async function deleteExerciseProgress(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.exercise_progress = (store.exercise_progress ?? []).filter((r) => r.id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exercise_progress").delete().eq("id", id);
  if (error) throw error;
}

/** Elimina tot el progrés d'un client (GDPR). */
export async function deleteAllProgressForClient(clientId: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const ceIds = new Set(
      store.client_exercises
        .filter((ce) => ce.client_id === clientId)
        .map((ce) => ce.id),
    );
    store.exercise_progress = (store.exercise_progress ?? []).filter(
      (r) => !ceIds.has(r.client_exercise_id),
    );
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  // El cascade de client_exercises → exercise_progress ho gestiona a BD,
  // però si es crida explícitament per GDPR ho fem igualment per simetria.
  const { data: ces } = await admin
    .from("client_exercises")
    .select("id")
    .eq("client_id", clientId);
  if (ces && ces.length > 0) {
    await admin
      .from("exercise_progress")
      .delete()
      .in("client_exercise_id", ces.map((c) => c.id));
  }
}
