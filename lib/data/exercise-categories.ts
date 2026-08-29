import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";

/**
 * Categories d'exercici. Abans eren un enum a la base (0003) i afegir-ne una
 * volia dir una migració; des de la 0057 són una taula que mantenen els
 * mateixos que mantenen la biblioteca.
 */

export type ExerciseCategoryItem = {
  id: string;
  name: string;
  /** Quants exercicis la fan servir. És el que decideix si es pot esborrar. */
  exerciseCount: number;
};

/** Totes, per ordre alfabètic, amb el recompte d'exercicis. */
export async function listExerciseCategories(): Promise<ExerciseCategoryItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.exercise_categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        exerciseCount: store.exercises.filter((e) => e.category === c.id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ca"));
  }

  const supabase = await createClient();
  // El recompte va amb la relació inversa i no amb una consulta per categoria:
  // amb deu categories serien deu viatges per pintar una llista.
  const { data, error } = await supabase
    .from("exercise_categories")
    .select("id, name, exercises(count)")
    .order("name", { ascending: true });
  if (error) throw error;

  type Row = { id: string; name: string; exercises: { count: number }[] };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    exerciseCount: r.exercises?.[0]?.count ?? 0,
  }));
}

/** Neteja el nom: sense espais sobrants i amb un límit raonable. */
function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 60);
}

export type CreateCategoryResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

/**
 * Crea una categoria. Si ja existeix una amb aquest nom, torna la que hi ha en
 * comptes d'un error: qui l'escriu vol tenir-la, i que ja hi fos no és cap
 * fracàs. La unicitat la garanteix l'índex de la 0057, no aquesta comprovació.
 */
export async function createExerciseCategory(
  rawName: string,
): Promise<CreateCategoryResult> {
  const name = cleanName(rawName);
  if (!name) return { ok: false, error: "Escriu un nom per a la categoria." };

  if (USE_MOCK) {
    const store = getStore();
    const existing = store.exercise_categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return { ok: true, id: existing.id, name: existing.name };
    const id = crypto.randomUUID();
    store.exercise_categories.push({
      id,
      name,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return { ok: true, id, name };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_categories")
    .insert({ name })
    .select("id, name")
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("exercise_categories")
      .select("id, name")
      .ilike("name", name)
      .maybeSingle();
    if (existing) return { ok: true, id: existing.id, name: existing.name };
  }
  if (error || !data)
    return { ok: false, error: "No s'ha pogut crear la categoria." };
  return { ok: true, id: data.id, name: data.name };
}

export type DeleteCategoryResult = { ok: true } | { ok: false; error: string };

/**
 * Esborra una categoria BUIDA.
 *
 * Es compta abans per poder dir quants exercicis la fan servir —"no es pot
 * esborrar" sense el número obliga a anar a buscar-los un per un—, però qui
 * ho impedeix de debò és el ON DELETE RESTRICT de la 0057: entre el recompte i
 * el DELETE algú podria haver-hi assignat un exercici.
 */
export async function deleteExerciseCategory(
  id: string,
): Promise<DeleteCategoryResult> {
  if (USE_MOCK) {
    const store = getStore();
    const used = store.exercises.filter((e) => e.category === id).length;
    if (used > 0) return { ok: false, error: inUseMessage(used) };
    store.exercise_categories = store.exercise_categories.filter(
      (c) => c.id !== id,
    );
    saveStore(store);
    return { ok: true };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("category", id);
  if ((count ?? 0) > 0) return { ok: false, error: inUseMessage(count ?? 0) };

  const { error } = await supabase
    .from("exercise_categories")
    .delete()
    .eq("id", id);
  // 23503 = violació de clau forana: hi ha exercicis que hi apunten.
  if (error?.code === "23503")
    return {
      ok: false,
      error:
        "Aquesta categoria s'ha començat a fer servir mentre la miraves. Torna a carregar la pàgina.",
    };
  if (error) return { ok: false, error: "No s'ha pogut esborrar la categoria." };
  return { ok: true };
}

export function inUseMessage(count: number): string {
  return count === 1
    ? "No es pot esborrar: hi ha 1 exercici en aquesta categoria."
    : `No es pot esborrar: hi ha ${count} exercicis en aquesta categoria.`;
}
