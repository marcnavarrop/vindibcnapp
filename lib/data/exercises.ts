import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import type { ExerciseCategory } from "@/types/database";

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string | null;
  videoUrl: string | null;
};

export type ExerciseInput = {
  name: string;
  category: ExerciseCategory;
  description: string | null;
  videoUrl: string | null;
};

type Row = {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string | null;
  video_url: string | null;
};

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  name: r.name,
  category: r.category,
  description: r.description,
  videoUrl: r.video_url,
});

export async function listExercises(): Promise<Exercise[]> {
  if (USE_MOCK) return getStore().exercises.map(toExercise);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, category, description, video_url")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toExercise);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  if (USE_MOCK) {
    const e = getStore().exercises.find((x) => x.id === id);
    return e ? toExercise(e) : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, category, description, video_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toExercise(data) : null;
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.exercises.push({
      id,
      name: input.name,
      category: input.category,
      description: input.description,
      video_url: input.videoUrl,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: input.name,
      category: input.category,
      description: input.description,
      video_url: input.videoUrl,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateExercise(
  id: string,
  input: ExerciseInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const e = store.exercises.find((x) => x.id === id);
    if (!e) throw new Error("Exercici no trobat.");
    e.name = input.name;
    e.category = input.category;
    e.description = input.description;
    e.video_url = input.videoUrl;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({
      name: input.name,
      category: input.category,
      description: input.description,
      video_url: input.videoUrl,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteExercise(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.exercises = store.exercises.filter((x) => x.id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
}
