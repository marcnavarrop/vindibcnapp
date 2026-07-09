import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";

export type DataAccessAction = "export" | "delete";

/**
 * Deixa constància d'una acció RGPD (exportació o supressió) sobre les dades
 * d'un client. Fa servir service_role perquè en la supressió el context ja
 * treballa amb l'Admin API.
 */
export async function logDataAccess(input: {
  actorId: string | null;
  subjectProfileId: string;
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
