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
  measurements: unknown[];
  exercises: unknown[];
  consents: unknown[];
  /**
   * Metadades dels documents pujats (nom, data, mida).
   * Els fitxers binaris no s'inclouen en el JSON; el client pot descarregar-los
   * individualment des de la seva àrea mentre el compte estigui actiu.
   */
  documents: unknown[];
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
        measurements: store.measurements.filter((m) => m.client_id === clientId),
        exercises: store.client_exercises
          .filter((ce) => ce.client_id === clientId)
          .map((ce) => ({ ...ce, exercise_name: exMap.get(ce.exercise_id) })),
        consents: store.consents.filter(
          (c) => c.user_id === client.profile_id,
        ),
        documents: store.client_documents
          .filter((d) => d.client_id === clientId)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ storage_path: _sp, ...meta }) => meta),
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

  const [profile, bonos, reservations, payments, measurements, exercises, consents, documents] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", profileId).single(),
      admin.from("bonos").select("*").eq("client_id", clientId),
      admin.from("reservations").select("*").eq("client_id", clientId),
      admin.from("payments").select("*").eq("client_id", clientId),
      admin.from("measurements").select("*").eq("client_id", clientId),
      admin
        .from("client_exercises")
        .select("*, exercise:exercises(name, category)")
        .eq("client_id", clientId),
      admin.from("consents").select("*").eq("user_id", profileId),
      admin
        .from("client_documents")
        .select("id, client_id, uploaded_by, file_name, file_size, mime_type, description, uploaded_at")
        .eq("client_id", clientId),
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
      measurements: measurements.data ?? [],
      exercises: exercises.data ?? [],
      consents: consents.data ?? [],
      documents: documents.data ?? [],
    },
  };
}
