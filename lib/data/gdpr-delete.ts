import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { bonoConcept } from "@/lib/data/payments";
import { deleteTrialsForClient } from "@/lib/data/trial-bookings";
import { deleteAllClientDocuments } from "@/lib/data/client-documents";
import type { ServiceType } from "@/types/database";
import { authErrorCa } from "@/lib/auth-errors";
import { archiveClinicalHistory, type ArchiveOutcome } from "@/lib/data/clinical-archive";

export type DeleteResult = { profileId: string; label: string; archive: ArchiveOutcome };

/**
 * Supressió d'un client (dret a l'oblit). Estratègia: hard delete de tot el
 * rastre personal + retenció dels pagaments anonimitzats (obligació fiscal).
 *
 * 1. Abans d'esborrar, es fixa el `concept` als pagaments que no en tinguin
 *    (a partir del seu bo) perquè el registre contable conservi QUÈ es va
 *    facturar quan es desvinculi del client.
 * 2. S'elimina l'usuari de Supabase Auth (Admin API). Això cascadeja:
 *    auth.users → profiles → clients → (bons, reserves, mesures, exercicis,
 *    tests d'avaluació, historial clínic) i consents. Els pagaments queden amb client_id = NULL (retinguts).
 *
 * 0. PERÒ ABANS DE RES, l'arxiu clínic (0119): si el client té historial de
 *    fisioteràpia, es copia a l'arxiu (Llei 21/2000: 15 anys des de l'alta).
 *    Si l'arxivat falla, `archiveClinicalHistory` llença i aquí NO s'esborra
 *    res: ni els documents, ni les proves, ni el compte.
 */
export async function deleteClient(
  clientId: string,
  actorId: string,
): Promise<DeleteResult | null> {
  if (USE_MOCK) {
    const exists = getStore().clients.some((c) => c.id === clientId);
    if (!exists) return null;
    // Primer de tot: si falla, llença i no s'ha tocat res.
    const archive = await archiveClinicalHistory(clientId, actorId);
    const before = getStore();
    const client = before.clients.find((c) => c.id === clientId)!;
    const profile = before.profiles.find((p) => p.id === client.profile_id);
    const label = `${profile?.full_name ?? "—"} <${profile?.email ?? ""}>`;
    const profileId = client.profile_id;

    // RGPD: elimina també les seves sessions de prova (convertides o per email/tel).
    await deleteTrialsForClient({
      clientId,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
    });
    // Esborra documents del Storage (mock: només metadades).
    await deleteAllClientDocuments(clientId);
    // El magatzem es torna a llegir DESPRÉS: les dues crides d'abans desen el
    // seu, i amb el llegit abans es tornaven a escriure les proves i els
    // documents que acabaven d'esborrar.
    const store = getStore();

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
    // L'`on delete cascade` de la 0079: la nota se'n va amb la reserva.
    const keptReservations = new Set(store.reservations.map((r) => r.id));
    store.session_notes = store.session_notes.filter((n) =>
      keptReservations.has(n.reservation_id),
    );
    const ceIds = new Set(
      store.client_exercises.filter((ce) => ce.client_id === clientId).map((ce) => ce.id),
    );
    store.exercise_progress = (store.exercise_progress ?? []).filter(
      (ep) => !ceIds.has(ep.client_exercise_id),
    );
    store.client_exercises = store.client_exercises.filter(
      (ce) => ce.client_id !== clientId,
    );
    // Els tests d'avaluació (0113) cauen amb el client (`on delete cascade`).
    store.client_tests = store.client_tests.filter((t) => t.client_id !== clientId);
    store.client_test_entries = store.client_test_entries.filter((e) => e.client_id !== clientId);
    store.consents = store.consents.filter((c) => c.user_id !== profileId);
    // L'historial clínic (0110) cau amb el client (`on delete cascade`).
    store.clinical_first_visits = store.clinical_first_visits.filter((f) => f.client_id !== clientId);
    store.clinical_followups = store.clinical_followups.filter((f) => f.client_id !== clientId);
    store.clinical_seen = store.clinical_seen.filter((s) => s.client_id !== clientId);
    store.notification_preferences = store.notification_preferences.filter(
      (n) => n.profile_id !== profileId,
    );
    store.notification_log = store.notification_log.filter(
      (n) => n.profile_id !== profileId,
    );
    // `demo_profiles` cau amb el perfil (`on delete cascade`, 0110).
    store.demo_profiles = store.demo_profiles.filter((d) => d.profile_id !== profileId);
    store.clients = store.clients.filter((c) => c.id !== clientId);
    store.profiles = store.profiles.filter((p) => p.id !== profileId);
    saveStore(store);
    return { profileId, label, archive };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select(
      "id, profile_id, profile:profiles!clients_profile_id_fkey(full_name, email, phone)",
    )
    .eq("id", clientId)
    .single();
  if (!client) return null;
  const profileId = client.profile_id as string;
  const p = (
    client as {
      profile: { full_name?: string; email?: string; phone?: string } | null;
    }
  ).profile;
  const label = `${p?.full_name ?? "—"} <${p?.email ?? ""}>`;

  // Arxiu clínic, ABANS de qualsevol esborrat. Si falla, llença: no s'esborra res.
  const archive = await archiveClinicalHistory(clientId, actorId);

  // RGPD: elimina també les seves sessions de prova (convertides o per email/tel).
  await deleteTrialsForClient({
    clientId,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
  });

  // 0. Esborra documents del Storage + metadades (abans del cascade d'Auth).
  await deleteAllClientDocuments(clientId);

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
  if (error) throw new Error(authErrorCa(error, "No s'ha pogut eliminar el compte d'accés."));

  return { profileId, label, archive };
}
