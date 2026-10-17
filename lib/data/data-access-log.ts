import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import type { DataAccessLogAction } from "@/types/database";

export type DataAccessAction = DataAccessLogAction;

/**
 * Deixa constància d'una acció RGPD (exportació o supressió) sobre les dades
 * d'un client. Fa servir service_role perquè en la supressió el context ja
 * treballa amb l'Admin API.
 */
export async function logDataAccess(input: {
  actorId: string | null;
  /** Null quan el perfil ja no existeix (l'arxiu clínic d'un client esborrat). */
  subjectProfileId: string | null;
  subjectLabel: string;
  action: DataAccessAction;
  details?: string | null;
}): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.data_access_log.push({
      id: crypto.randomUUID(),
      actor_id: input.actorId,
      subject_profile_id: input.subjectProfileId,
      subject_label: input.subjectLabel,
      action: input.action,
      details: input.details ?? null,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  await admin.from("data_access_log").insert({
    actor_id: input.actorId,
    subject_profile_id: input.subjectProfileId,
    subject_label: input.subjectLabel,
    action: input.action,
    details: input.details ?? null,
  });
}

/**
 * L'última entrada d'una acció sobre un perfil: la pantalla de baixa d'un
 * professional (0128) hi llegeix què es va fer en donar-lo de baixa.
 */
export async function lastDataAccess(
  subjectProfileId: string,
  action: DataAccessAction,
): Promise<{ details: string | null; createdAt: string } | null> {
  if (USE_MOCK) {
    const row = getStore()
      .data_access_log.filter((l) => l.subject_profile_id === subjectProfileId && l.action === action)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return row ? { details: row.details, createdAt: row.created_at } : null;
  }
  const { data, error } = await createAdminClient()
    .from("data_access_log")
    .select("details, created_at")
    .eq("subject_profile_id", subjectProfileId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { details: data.details, createdAt: data.created_at } : null;
}
