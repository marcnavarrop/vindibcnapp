import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";

export type Exercise = {
  id: string;
  name: string;
  /** FK a exercise_categories (0057). */
  categoryId: string;
  /** El nom que es veu. Ve de la taula, ja no d'un mapa d'etiquetes. */
  categoryName: string;
  description: string | null;
  videoUrl: string | null;
  videoFilePath: string | null;
};

export type ExerciseInput = {
  name: string;
  categoryId: string;
  description: string | null;
  videoUrl: string | null;
  videoFilePath: string | null;
};

type Row = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  video_url: string | null;
  video_file_path: string | null;
  cat?: { name: string } | null;
};

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  name: r.name,
  categoryId: r.category,
  categoryName: r.cat?.name ?? "—",
  description: r.description,
  videoUrl: r.video_url,
  videoFilePath: r.video_file_path,
});

/** El nom de la categoria s'incrusta sempre: la biblioteca l'ensenya a cada fitxa. */
const SELECT =
  "id, name, category, description, video_url, video_file_path, cat:exercise_categories!exercises_category_fkey(name)";

export async function listExercises(): Promise<Exercise[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.exercises.map((e) =>
      toExercise({
        ...e,
        cat: {
          name:
            store.exercise_categories.find((c) => c.id === e.category)?.name ??
            "—",
        },
      } as unknown as Row),
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as unknown as Row[]).map(toExercise);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  if (USE_MOCK) {
    const store = getStore();
    const e = store.exercises.find((x) => x.id === id);
    if (!e) return null;
    return toExercise({
      ...e,
      cat: {
        name:
          store.exercise_categories.find((c) => c.id === e.category)?.name ??
          "—",
      },
    } as unknown as Row);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toExercise(data as unknown as Row) : null;
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.exercises.push({
      id,
      name: input.name,
      category: input.categoryId,
      description: input.description,
      video_url: input.videoUrl,
      video_file_path: input.videoFilePath,
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
      category: input.categoryId,
      description: input.description,
      video_url: input.videoUrl,
      video_file_path: input.videoFilePath,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateExercise(
  id: string,
  input: ExerciseInput,
  oldVideoFilePath?: string | null,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const e = store.exercises.find((x) => x.id === id);
    if (!e) throw new Error("Exercici no trobat.");
    e.name = input.name;
    e.category = input.categoryId;
    e.description = input.description;
    e.video_url = input.videoUrl;
    e.video_file_path = input.videoFilePath;
    saveStore(store);
    return;
  }

  // Si hi havia un vídeo pujat i s'ha canviat (o eliminat), esborra l'arxiu de Storage.
  if (oldVideoFilePath && oldVideoFilePath !== input.videoFilePath) {
    const { deleteExerciseVideo } = await import("@/lib/data/exercise-videos");
    await deleteExerciseVideo(oldVideoFilePath).catch(() => null);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({
      name: input.name,
      category: input.categoryId,
      description: input.description,
      video_url: input.videoUrl,
      video_file_path: input.videoFilePath,
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
  // Esborra el vídeo de Storage si n'hi havia
  const supabase = await createClient();
  const { data: ex } = await supabase
    .from("exercises")
    .select("video_file_path")
    .eq("id", id)
    .single();
  if (ex?.video_file_path) {
    const { deleteExerciseVideo } = await import("@/lib/data/exercise-videos");
    await deleteExerciseVideo(ex.video_file_path).catch(() => null);
  }
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
}
