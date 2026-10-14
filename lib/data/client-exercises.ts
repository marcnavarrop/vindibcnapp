import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";
import { PAUTA_MAX } from "@/lib/workout-pauta";

/**
 * Exercicis assignats a un client, organitzats per DIES (0112).
 *
 * Un client té dies («Dia 1, 2, 3…» en cicle, amb nom opcional) i cada
 * exercici assignat té un dia (o cap: «Sense dia»), un ordre dins del dia i una
 * pauta opcional. El client marca «Dia fet» el dia que l'ha fet.
 *
 * TOT va amb la sessió de qui crida: la RLS de la 0112 decideix (admin i el
 * professional assignat escriuen; el client llegeix i marca el seu «dia fet»).
 * Les funcions de la base (`move_client_exercise`, `reorder_…`, `duplicate_…`)
 * són SECURITY INVOKER: si qui crida no hi té permís, fallen sense tocar res.
 *
 * EL PROGRÉS NO ES PERD: `exercise_progress` penja de l'assignació. Moure un
 * exercici de dia és canviar-li el `day_id` (mai esborrar-lo i tornar-lo a
 * crear), i esborrar un dia deixa els seus exercicis a «Sense dia».
 */

export type AssignedExercise = {
  id: string; // id de la asignación (client_exercises.id)
  exerciseId: string;
  name: string;
  categoryName: string;
  description: string | null;
  videoUrl: string | null;
  videoFilePath: string | null;
  notes: string | null;
  assignedAt: string;
  /** Dia de la pauta; null = «Sense dia». */
  dayId: string | null;
  position: number;
  sets: number | null;
  /** Repeticions o temps: «10», «8-10», «30 s». */
  reps: string | null;
  /** Càrrega: «20 kg», «RPE 7». */
  load: string | null;
  restSeconds: number | null;
};

export type WorkoutDay = {
  id: string;
  /** El número que es veu («Dia 2»): l'ordre, no la columna `position`. */
  number: number;
  name: string | null;
};

export type WorkoutLog = {
  id: string;
  dayId: string | null;
  /** Foto del dia quan es va marcar (si després s'esborra o es reanomena). */
  dayNumber: number;
  dayName: string | null;
  doneOn: string;
};

export type WorkoutPlan = {
  days: WorkoutDay[];
  /** Ordenats per dia i, dins de cada dia, per `position`. */
  exercises: AssignedExercise[];
  /** Els «dia fet» més recents primer. */
  logs: WorkoutLog[];
};

/** Quants «dia fet» es porten a la pantalla: prou per veure les últimes setmanes. */
const RECENT_LOGS = 60;


type MockCE = ReturnType<typeof getStore>["client_exercises"][number];

/** Fitxers de simulació d'abans de la 0112: sense dia, ni ordre, ni pauta. */
function ceDefaults(ce: MockCE): MockCE {
  return {
    ...ce,
    day_id: ce.day_id ?? null,
    position: ce.position ?? 0,
    sets: ce.sets ?? null,
    reps: ce.reps ?? null,
    load: ce.load ?? null,
    rest_seconds: ce.rest_seconds ?? null,
  };
}

function sortExercises(list: AssignedExercise[], days: WorkoutDay[]): AssignedExercise[] {
  // «Sense dia» al final; dins de cada dia, l'ordre; a igualtat, el més antic primer.
  const rank = new Map(days.map((d) => [d.id, d.number]));
  const r = (id: string | null) => (id ? (rank.get(id) ?? 1e6) : 1e6 + 1);
  return [...list].sort(
    (a, b) =>
      r(a.dayId) - r(b.dayId) ||
      a.position - b.position ||
      a.assignedAt.localeCompare(b.assignedAt),
  );
}

/** Ejercicios asignados a un cliente (con su día, orden y pauta). */
export async function listClientExercises(
  clientId: string,
): Promise<AssignedExercise[]> {
  return (await getWorkoutPlan(clientId)).exercises;
}

/** La pauta sencera d'un client: dies, exercicis i «dia fet» recents. */
export async function getWorkoutPlan(clientId: string): Promise<WorkoutPlan> {
  if (USE_MOCK) {
    const store = getStore();
    const days = store.client_workout_days
      .filter((d) => d.client_id === clientId)
      .sort((a, b) => a.position - b.position)
      .map((d, i) => ({ id: d.id, number: i + 1, name: d.name }));
    const exercises = store.client_exercises
      .filter((ce) => ce.client_id === clientId)
      .map(ceDefaults)
      .map((ce) => {
        const ex = store.exercises.find((e) => e.id === ce.exercise_id);
        return {
          id: ce.id,
          exerciseId: ce.exercise_id,
          name: ex?.name ?? "—",
          categoryName:
            store.exercise_categories.find((c) => c.id === ex?.category)?.name ??
            "—",
          description: ex?.description ?? null,
          videoUrl: ex?.video_url ?? null,
          videoFilePath: ex?.video_file_path ?? null,
          notes: ce.notes,
          assignedAt: ce.assigned_at,
          dayId: ce.day_id,
          position: ce.position,
          sets: ce.sets,
          reps: ce.reps,
          load: ce.load,
          restSeconds: ce.rest_seconds,
        };
      });
    const logs = store.client_workout_logs
      .filter((l) => l.client_id === clientId)
      .sort((a, b) => b.done_on.localeCompare(a.done_on) || b.created_at.localeCompare(a.created_at))
      .slice(0, RECENT_LOGS)
      .map(logFromRow);
    return { days, exercises: sortExercises(exercises, days), logs };
  }

  const supabase = await createClient();
  const [daysRes, exRes, logsRes] = await Promise.all([
    supabase
      .from("client_workout_days")
      .select("id, name, position")
      .eq("client_id", clientId)
      .order("position"),
    supabase
      .from("client_exercises")
      .select(
        `id, exercise_id, notes, assigned_at, day_id, position, sets, reps, load, rest_seconds,
         exercise:exercises!client_exercises_exercise_id_fkey(
           name, description, video_url, video_file_path,
           cat:exercise_categories!exercises_category_fkey(name)
         )`,
      )
      .eq("client_id", clientId)
      .order("position"),
    supabase
      .from("client_workout_logs")
      .select("id, day_id, day_name, day_number, done_on, created_at")
      .eq("client_id", clientId)
      .order("done_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_LOGS),
  ]);
  if (daysRes.error) throw daysRes.error;
  if (exRes.error) throw exRes.error;
  if (logsRes.error) throw logsRes.error;

  const days = (daysRes.data ?? []).map((d, i) => ({
    id: d.id,
    number: i + 1,
    name: d.name,
  }));

  type Row = {
    id: string;
    exercise_id: string;
    notes: string | null;
    assigned_at: string;
    day_id: string | null;
    position: number;
    sets: number | null;
    reps: string | null;
    load: string | null;
    rest_seconds: number | null;
    exercise: {
      name: string;
      description: string | null;
      video_url: string | null;
      video_file_path: string | null;
      cat: { name: string } | null;
    } | null;
  };
  const exercises = (exRes.data as unknown as Row[]).map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    name: r.exercise?.name ?? "—",
    categoryName: r.exercise?.cat?.name ?? "—",
    description: r.exercise?.description ?? null,
    videoUrl: r.exercise?.video_url ?? null,
    videoFilePath: r.exercise?.video_file_path ?? null,
    notes: r.notes,
    assignedAt: r.assigned_at,
    dayId: r.day_id,
    position: r.position,
    sets: r.sets,
    reps: r.reps,
    load: r.load,
    restSeconds: r.rest_seconds,
  }));

  return {
    days,
    exercises: sortExercises(exercises, days),
    logs: (logsRes.data ?? []).map(logFromRow),
  };
}

function logFromRow(l: {
  id: string;
  day_id: string | null;
  day_name: string | null;
  day_number: number;
  done_on: string;
}): WorkoutLog {
  return {
    id: l.id,
    dayId: l.day_id,
    dayNumber: l.day_number,
    dayName: l.day_name,
    doneOn: l.done_on,
  };
}

// ─── Pauta ──────────────────────────────────────────────────────────────────

export type Pauta = {
  sets: number | null;
  reps: string | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
};

export type AssignExerciseInput = {
  clientId: string;
  exerciseId: string;
  assignedBy: string;
  /** Null = «Sense dia». */
  dayId: string | null;
} & Pauta;

/**
 * Asigna un ejercicio a un cliente, al final del día. La escritura va con el
 * cliente del usuario (RLS): admin o el entrenador/a asignado del cliente.
 */
export async function assignExercise(input: AssignExerciseInput): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    if (input.dayId && !store.client_workout_days.some((d) => d.id === input.dayId && d.client_id === input.clientId))
      throw new Error("Aquest dia no és d'aquest client.");
    store.client_exercises.push({
      id: crypto.randomUUID(),
      client_id: input.clientId,
      exercise_id: input.exerciseId,
      assigned_by: input.assignedBy,
      notes: input.notes,
      assigned_at: new Date().toISOString(),
      day_id: input.dayId,
      position: mockNextPosition(store, input.clientId, input.dayId),
      sets: input.sets,
      reps: input.reps,
      load: input.load,
      rest_seconds: input.restSeconds,
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  // Sense `position`: la posa el trigger de la 0112 (al final del dia).
  const { error } = await supabase.from("client_exercises").insert({
    client_id: input.clientId,
    exercise_id: input.exerciseId,
    assigned_by: input.assignedBy,
    notes: input.notes,
    day_id: input.dayId,
    sets: input.sets,
    reps: input.reps,
    load: input.load,
    rest_seconds: input.restSeconds,
  });
  if (error) throw error;
}

/** Canvia la pauta i les notes d'un exercici assignat (admin o el seu professional). */
export async function updateExercisePauta(id: string, pauta: Pauta): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const ce = store.client_exercises.find((x) => x.id === id);
    if (!ce) throw new Error("Aquest exercici ja no existeix.");
    Object.assign(ce, {
      sets: pauta.sets,
      reps: pauta.reps,
      load: pauta.load,
      rest_seconds: pauta.restSeconds,
      notes: pauta.notes,
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_exercises")
    .update({
      sets: pauta.sets,
      reps: pauta.reps,
      load: pauta.load,
      rest_seconds: pauta.restSeconds,
      notes: pauta.notes,
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw new Error("No s'ha pogut desar la pauta.");
}

/** Elimina una asignación (admin o entrenador/a asignado, vía RLS). S'endú el seu progrés. */
export async function removeClientExercise(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.client_exercises = store.client_exercises.filter((ce) => ce.id !== id);
    store.exercise_progress = store.exercise_progress.filter((p) => p.client_exercise_id !== id);
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

// ─── Moure i ordenar exercicis ──────────────────────────────────────────────

function mockNextPosition(
  store: ReturnType<typeof getStore>,
  clientId: string,
  dayId: string | null,
  exceptId?: string,
): number {
  const same = store.client_exercises
    .map(ceDefaults)
    .filter((ce) => ce.client_id === clientId && (ce.day_id ?? null) === dayId && ce.id !== exceptId);
  return (same.length ? Math.max(...same.map((ce) => ce.position)) : 0) + 10;
}

/** Mou un exercici a un altre dia (o a «Sense dia»), al final. Conserva el progrés. */
export async function moveClientExercise(id: string, dayId: string | null): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const ce = store.client_exercises.find((x) => x.id === id);
    if (!ce) throw new Error("Aquest exercici ja no existeix.");
    if (dayId && !store.client_workout_days.some((d) => d.id === dayId && d.client_id === ce.client_id))
      throw new Error("Aquest dia no és d'aquest client.");
    ce.position = mockNextPosition(store, ce.client_id, dayId, id);
    ce.day_id = dayId;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_client_exercise", { p_id: id, p_day: dayId });
  if (error) throw error;
}

/** Nou ordre dels exercicis d'un dia (o de «Sense dia»): la llista sencera, en ordre. */
export async function reorderClientExercises(
  clientId: string,
  dayId: string | null,
  ids: string[],
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const mine = store.client_exercises.filter(
      (ce) => ce.client_id === clientId && (ce.day_id ?? null) === dayId,
    );
    if (mine.length !== ids.length || new Set(ids).size !== ids.length || !ids.every((x) => mine.some((ce) => ce.id === x)))
      throw new Error("La llista d'exercicis no quadra amb els del dia.");
    ids.forEach((x, i) => {
      mine.find((ce) => ce.id === x)!.position = (i + 1) * 10;
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_client_exercises", {
    p_client: clientId,
    p_day: dayId,
    p_ids: ids,
  });
  if (error) throw error;
}

// ─── Dies ───────────────────────────────────────────────────────────────────

/** Un dia nou al final del cicle. Retorna el seu id. */
export async function createWorkoutDay(clientId: string, name: string | null): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const mine = store.client_workout_days.filter((d) => d.client_id === clientId);
    const id = crypto.randomUUID();
    store.client_workout_days.push({
      id,
      client_id: clientId,
      position: (mine.length ? Math.max(...mine.map((d) => d.position)) : 0) + 1,
      name,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_client_workout_day", {
    p_client: clientId,
    p_name: name,
  });
  if (error) throw error;
  return data as string;
}

/** Reanomena un dia. Null (o buit) torna a «Dia N». */
export async function renameWorkoutDay(dayId: string, name: string | null): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const d = store.client_workout_days.find((x) => x.id === dayId);
    if (!d) throw new Error("Aquest dia ja no existeix.");
    d.name = name;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_workout_days")
    .update({ name })
    .eq("id", dayId)
    .select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw new Error("No s'ha pogut reanomenar el dia.");
}

/**
 * Esborra un dia. Els seus exercicis passen a «Sense dia» (`on delete set
 * null`): ni ells ni el seu progrés s'esborren. Els «dia fet» es queden, amb la
 * foto del dia.
 */
export async function deleteWorkoutDay(dayId: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const d = store.client_workout_days.find((x) => x.id === dayId);
    if (!d) throw new Error("Aquest dia ja no existeix.");
    // Al final de «Sense dia», en el mateix ordre que tenien al dia.
    const moving = store.client_exercises
      .filter((ce) => ce.day_id === dayId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const ce of moving) {
      ce.position = mockNextPosition(store, ce.client_id, null, ce.id);
      ce.day_id = null;
    }
    for (const l of store.client_workout_logs) if (l.day_id === dayId) l.day_id = null;
    store.client_workout_days = store.client_workout_days.filter((x) => x.id !== dayId);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_workout_days")
    .delete()
    .eq("id", dayId)
    .select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw new Error("No s'ha pogut esborrar el dia.");
}

/** Nou ordre dels dies: la llista sencera dels dies del client, en ordre. */
export async function reorderWorkoutDays(clientId: string, ids: string[]): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const mine = store.client_workout_days.filter((d) => d.client_id === clientId);
    if (mine.length !== ids.length || new Set(ids).size !== ids.length || !ids.every((x) => mine.some((d) => d.id === x)))
      throw new Error("La llista de dies no quadra amb els dies del client.");
    ids.forEach((x, i) => {
      mine.find((d) => d.id === x)!.position = i + 1;
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_client_workout_days", {
    p_client: clientId,
    p_ids: ids,
  });
  if (error) throw error;
}

/** Còpia del dia al final, amb els exercicis, la pauta i l'ordre (sense progrés). */
export async function duplicateWorkoutDay(dayId: string): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const d = store.client_workout_days.find((x) => x.id === dayId);
    if (!d) throw new Error("Aquest dia ja no existeix.");
    const mine = store.client_workout_days.filter((x) => x.client_id === d.client_id);
    const id = crypto.randomUUID();
    store.client_workout_days.push({
      id,
      client_id: d.client_id,
      position: Math.max(...mine.map((x) => x.position)) + 1,
      name: d.name ? `${d.name} (còpia)`.slice(0, PAUTA_MAX.name) : null,
      created_at: new Date().toISOString(),
    });
    const now = new Date().toISOString();
    for (const ce of store.client_exercises.filter((x) => x.day_id === dayId).map(ceDefaults)) {
      store.client_exercises.push({ ...ce, id: crypto.randomUUID(), day_id: id, assigned_at: now });
    }
    saveStore(store);
    return id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_client_workout_day", { p_day: dayId });
  if (error) throw error;
  return data as string;
}

// ─── «Dia fet» ──────────────────────────────────────────────────────────────

/** Ja estava marcat avui (la restricció única de la 0112). */
export class AlreadyDoneError extends Error {}

/**
 * El client marca que ha fet el dia, amb data d'avui (hora del centre). La base
 * hi posa la foto del dia (nom i número). Només el client dueny (RLS).
 */
export async function markWorkoutDayDone(clientId: string, dayId: string, profileId: string): Promise<void> {
  const today = centerToday();
  if (USE_MOCK) {
    const store = getStore();
    const days = store.client_workout_days
      .filter((d) => d.client_id === clientId)
      .sort((a, b) => a.position - b.position);
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx < 0) throw new Error("Aquest dia no és d'aquest client.");
    if (store.client_workout_logs.some((l) => l.day_id === dayId && l.done_on === today))
      throw new AlreadyDoneError();
    store.client_workout_logs.push({
      id: crypto.randomUUID(),
      client_id: clientId,
      day_id: dayId,
      day_name: days[idx].name,
      day_number: idx + 1,
      done_on: today,
      created_by: profileId,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  // Sense `done_on`: el posa la base (avui a Madrid), i la RLS no n'accepta cap altre.
  const { error } = await supabase
    .from("client_workout_logs")
    .insert({ client_id: clientId, day_id: dayId, created_by: profileId });
  if (error?.code === "23505") throw new AlreadyDoneError();
  if (error) throw error;
}

/** Desmarca el «dia fet» d'AVUI d'un dia. Els d'abans no es poden desmarcar. */
export async function unmarkWorkoutDayDone(clientId: string, dayId: string): Promise<void> {
  const today = centerToday();
  if (USE_MOCK) {
    const store = getStore();
    store.client_workout_logs = store.client_workout_logs.filter(
      (l) => !(l.client_id === clientId && l.day_id === dayId && l.done_on === today),
    );
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_workout_logs")
    .delete()
    .eq("client_id", clientId)
    .eq("day_id", dayId)
    .eq("done_on", today);
  if (error) throw error;
}
