import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { bonoConcept } from "@/lib/data/payments";
import type { ServiceType } from "@/types/database";

export type DeleteResult = { profileId: string; label: string };

/**
 * Supressió d'un client (dret a l'oblit). Estratègia: hard delete de tot el
 * rastre personal + retenció dels pagaments anonimitzats (obligació fiscal).
 *
 * 1. Abans d'esborrar, es fixa el `concept` als pagaments que no en tinguin
 *    (a partir del seu bo) perquè el registre contable conservi QUÈ es va
 *    facturar quan es desvinculi del client.
 * 2. S'elimina l'usuari de Supabase Auth (Admin API). Això cascadeja:
 *    auth.users → profiles → clients → (bons, reserves, mesures, exercicis) i
 *    consents. Els pagaments queden amb client_id = NULL (retinguts).
 */
export async function deleteClient(
  clientId: string,
): Promise<DeleteResult | null> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.id === clientId);
    if (!client) return null;
    const profile = store.profiles.find((p) => p.id === client.profile_id);
    const label = `${profile?.full_name ?? "—"} <${profile?.email ?? ""}>`;
    const profileId = client.profile_id;

    // Retenció anonimitzada dels pagaments amb concepte.
    for (const p of store.payments.filter((x) => x.client_id === clientId)) {
      if (!p.concept) {
        const bono = store.bonos.find((b) => b.id === p.bono_id);
        p.concept = bono
          ? bonoConcept(bono.service_type, bono.total_sessions)
          : "Pagament";
      }
      p.client_id = null;
      p.bono_id = null;
    }
    // Hard delete de la resta.
    store.bonos = store.bonos.filter((b) => b.client_id !== clientId);
    store.reservations = store.reservations.filter(
      (r) => r.client_id !== clientId,
    );
    store.measurements = store.measurements.filter(
      (m) => m.client_id !== clientId,
    );
    store.client_exercises = store.client_exercises.filter(
      (ce) => ce.client_id !== clientId,
    );
    store.consents = store.consents.filter((c) => c.user_id !== profileId);
    store.clients = store.clients.filter((c) => c.id !== clientId);
    store.profiles = store.profiles.filter((p) => p.id !== profileId);
    saveStore(store);
    return { profileId, label };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, profile_id, profile:profiles(full_name, email)")
    .eq("id", clientId)
    .single();
  if (!client) return null;
  const profileId = client.profile_id as string;
  const p = (client as { profile: { full_name?: string; email?: string } | null })
    .profile;
  const label = `${p?.full_name ?? "—"} <${p?.email ?? ""}>`;

  // 1. Fixa el concepte als pagaments sense concepte (abans de desvincular-los).
  const { data: pays } = await admin
    .from("payments")
    .select("id, concept, bono:bonos(service_type, total_sessions)")
    .eq("client_id", clientId)
    .is("concept", null);
  type PayRow = {
    id: string;
    bono: { service_type: ServiceType; total_sessions: number } | null;
  };
  for (const pay of (pays ?? []) as unknown as PayRow[]) {
    const concept = pay.bono
      ? bonoConcept(pay.bono.service_type, pay.bono.total_sessions)
      : "Pagament";
    await admin.from("payments").update({ concept }).eq("id", pay.id);
  }

  // 2. Elimina l'usuari d'Auth → cascada + payments.client_id = NULL.
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);

  return { profileId, label };
}
