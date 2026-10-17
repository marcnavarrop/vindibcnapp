import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";

export type ClientDataExport = {
  exportedAt: string;
  profile: Record<string, unknown> | null;
  client: Record<string, unknown> | null;
  bonos: unknown[];
  reservations: unknown[];
  payments: unknown[];
  exercise_progress: unknown[];
  /** Amb el dia, l'ordre i la pauta de cada exercici (0112). */
  exercises: unknown[];
  /** Els dies de la pauta (0112) i els «dia fet» que ha marcat. */
  workout_days: unknown[];
  workout_logs: unknown[];
  /** Els tests d'avaluació (0113), cadascun amb els seus registres. */
  tests: unknown[];
  consents: unknown[];
  documents: unknown[];
  /**
   * L'historial clínic (0110). El client no el veu a l'app; si demana les seves
   * dades, hi va sencer: primera visita i seguiments (amb qui els va escriure).
   */
  clinical_history: { first_visit: unknown | null; followups: unknown[] };
  /**
   * Les notes de sessió (0079), de totes les seves sessions: la data i el
   * servei de la sessió, qui la va escriure i el text. També les de
   * fisioteràpia (formen part de l'historial clínic).
   */
  session_notes: unknown[];
};

/**
 * Reuneix TOTES les dades personals d'un client (dret d'accés i portabilitat).
 * Fa servir service_role per garantir la completesa; el Route Handler valida
 * abans que qui ho demana és admin.
 */
export async function exportClientData(
  clientId: string,
): Promise<{ data: ClientDataExport; profileId: string; label: string } | null> {
  const exportedAt = new Date().toISOString();

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.id === clientId);
    if (!client) return null;
    const profile = store.profiles.find((p) => p.id === client.profile_id);
    const exMap = new Map(store.exercises.map((e) => [e.id, e.name]));
    return {
      profileId: client.profile_id,
      label: `${profile?.full_name ?? "—"} <${profile?.email ?? ""}>`,
      data: {
        exportedAt,
        profile: profile ?? null,
        client,
        bonos: store.bonos.filter((b) => b.client_id === clientId),
        reservations: store.reservations.filter((r) => r.client_id === clientId),
        payments: store.payments.filter((p) => p.client_id === clientId),
        exercise_progress: (store.exercise_progress ?? []).filter(
          (ep) => store.client_exercises.some((ce) => ce.client_id === clientId && ce.id === ep.client_exercise_id),
        ),
        exercises: store.client_exercises
          .filter((ce) => ce.client_id === clientId)
          .map((ce) => ({ ...ce, exercise_name: exMap.get(ce.exercise_id) })),
        workout_days: store.client_workout_days.filter((d) => d.client_id === clientId),
        workout_logs: store.client_workout_logs.filter((l) => l.client_id === clientId),
        tests: store.client_tests
          .filter((t) => t.client_id === clientId)
          .sort((a, b) => a.position - b.position)
          .map((t) => ({
            ...t,
            entries: store.client_test_entries
              .filter((e) => e.test_id === t.id)
              .sort((a, b) => a.measured_on.localeCompare(b.measured_on)),
          })),
        consents: store.consents.filter(
          (c) => c.user_id === client.profile_id,
        ),
        documents: store.client_documents
          .filter((d) => d.client_id === clientId)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ storage_path: _sp, ...meta }) => meta),
        clinical_history: {
          first_visit: store.clinical_first_visits.find((f) => f.client_id === clientId) ?? null,
          followups: store.clinical_followups.filter((f) => f.client_id === clientId),
        },
        session_notes: store.session_notes
          .map((n) => ({ n, r: store.reservations.find((r) => r.id === n.reservation_id) }))
          .filter(({ r }) => r?.client_id === clientId)
          .sort((a, b) => a.r!.scheduled_at.localeCompare(b.r!.scheduled_at))
          .map(({ n, r }) => ({
            ...n,
            session_at: r!.scheduled_at,
            service_type: r!.service_type,
            author_name: store.profiles.find((p) => p.id === n.author_id)?.full_name ?? null,
          })),
      },
    };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();
  if (!client) return null;
  const profileId = client.profile_id;

  const [
    profile,
    bonos,
    reservations,
    payments,
    ces,
    exercise_progress,
    workoutDays,
    workoutLogs,
    tests,
    testEntries,
    consents,
    documents,
    firstVisit,
    followups,
    sessionNotes,
  ] = await Promise.all([
      admin.from("profiles").select("*").eq("id", profileId).single(),
      admin.from("bonos").select("*").eq("client_id", clientId),
      admin.from("reservations").select("*").eq("client_id", clientId),
      admin.from("payments").select("*").eq("client_id", clientId),
      admin
        .from("client_exercises")
        .select("*, exercise:exercises(name, category)")
        .eq("client_id", clientId),
      admin
        .from("exercise_progress")
        .select("*, client_exercise:client_exercises!inner(client_id)")
        .eq("client_exercise.client_id", clientId),
      admin
        .from("client_workout_days")
        .select("*")
        .eq("client_id", clientId)
        .order("position", { ascending: true }),
      admin
        .from("client_workout_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("done_on", { ascending: true }),
      admin
        .from("client_tests")
        .select("*")
        .eq("client_id", clientId)
        .order("position", { ascending: true }),
      admin
        .from("client_test_entries")
        .select("*")
        .eq("client_id", clientId)
        .order("measured_on", { ascending: true })
        .order("created_at", { ascending: true }),
      admin.from("consents").select("*").eq("user_id", profileId),
      admin
        .from("client_documents")
        .select("id, client_id, uploaded_by, file_name, file_size, mime_type, description, uploaded_at")
        .eq("client_id", clientId),
      admin.from("clinical_first_visits").select("*").eq("client_id", clientId).maybeSingle(),
      admin
        .from("clinical_followups")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true }),
      admin
        .from("session_notes")
        .select("*, reservation:reservations!inner(client_id, scheduled_at, service_type), author:profiles!session_notes_author_id_fkey(full_name)")
        .eq("reservation.client_id", clientId)
        .limit(5000),
    ]);

  const p = profile.data as { full_name?: string; email?: string } | null;
  return {
    profileId,
    label: `${p?.full_name ?? "—"} <${p?.email ?? ""}>`,
    data: {
      exportedAt,
      profile: profile.data as Record<string, unknown> | null,
      client: client as Record<string, unknown>,
      bonos: bonos.data ?? [],
      reservations: reservations.data ?? [],
      payments: payments.data ?? [],
      exercise_progress: exercise_progress.data ?? [],
      exercises: ces.data ?? [],
      workout_days: workoutDays.data ?? [],
      workout_logs: workoutLogs.data ?? [],
      tests: (tests.data ?? []).map((t) => ({
        ...t,
        entries: (testEntries.data ?? []).filter((e) => e.test_id === t.id),
      })),
      consents: consents.data ?? [],
      documents: documents.data ?? [],
      clinical_history: { first_visit: firstVisit.data ?? null, followups: followups.data ?? [] },
      session_notes: ((sessionNotes.data ?? []) as unknown as {
        reservation_id: string;
        author_id: string | null;
        body: string;
        created_at: string;
        updated_at: string;
        reservation: { scheduled_at: string; service_type: string } | null;
        author: { full_name: string | null } | null;
      }[])
        .map(({ reservation, author, ...n }) => ({
          ...n,
          session_at: reservation?.scheduled_at ?? null,
          service_type: reservation?.service_type ?? null,
          author_name: author?.full_name ?? null,
        }))
        .sort((a, b) => String(a.session_at).localeCompare(String(b.session_at))),
    },
  };
}
