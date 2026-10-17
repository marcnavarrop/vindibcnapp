import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { DEFAULT_PREFERENCES } from "@/lib/notifications/preferences-defaults";

/**
 * LES NOVETATS DEL CENTRE PER CORREU (0124, art. 21.2 LSSI).
 *
 * Un client nou les rep per defecte (`community_email = true`, el posa el
 * trigger de la base). La llei hi demana dues coses que viuen aquí:
 *
 *   · Dir-l'hi en l'alta, amb la possibilitat de dir que no en aquell moment:
 *     `community_notice_at` NULL vol dir que encara no; el registre ho desa en
 *     el moment i, el client que ha creat l'admin, ho veu en el primer accés
 *     (la targeta de l'Inici).
 *   · Poder-se'n donar de baixa des de cada correu, sense sessió
 *     (`unsubscribeCommunity`, amb l'enllaç signat de lib/unsubscribe.ts).
 *
 * Clau de servei: qui crida ja ha comprovat qui és (la sessió del client o la
 * signatura de l'enllaç).
 */

type PrefRow = Store["notification_preferences"][number];

function mockRow(store: Store, profileId: string): PrefRow {
  let row = store.notification_preferences.find((p) => p.profile_id === profileId);
  if (!row) {
    row = {
      id: `np-${profileId}`,
      profile_id: profileId,
      ...DEFAULT_PREFERENCES,
      community_notice_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as PrefRow;
    store.notification_preferences.push(row);
  }
  return row;
}

/** Encara no se li ha dit (i què té ara). Sense fila: res pendent. */
export async function getCommunityNotice(profileId: string): Promise<{ pending: boolean; communityEmail: boolean }> {
  if (USE_MOCK) {
    const row = getStore().notification_preferences.find((p) => p.profile_id === profileId);
    // Només un NULL explícit és «pendent», com a la base: les files d'un
    // magatzem d'abans de la 0124 no tenen el camp i no han d'ensenyar res.
    return { pending: !!row && row.community_notice_at === null, communityEmail: !!row?.community_email };
  }
  const { data } = await createAdminClient()
    .from("notification_preferences")
    .select("community_email, community_notice_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  return { pending: !!data && !data.community_notice_at, communityEmail: !!data?.community_email };
}

/** El client ja ho sap i ha triat: rebre-les (`true`) o no. */
export async function confirmCommunityNotice(profileId: string, receive: boolean): Promise<void> {
  const now = new Date().toISOString();
  if (USE_MOCK) {
    const store = getStore();
    Object.assign(mockRow(store, profileId), { community_email: receive, community_notice_at: now });
    saveStore(store);
    return;
  }
  const { error } = await createAdminClient()
    .from("notification_preferences")
    .upsert({ profile_id: profileId, community_email: receive, community_notice_at: now }, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
}

/** Deixar de rebre-les (l'enllaç del correu). Torna si ja no les rebia. */
export async function unsubscribeCommunity(profileId: string): Promise<{ alreadyOff: boolean } | null> {
  if (USE_MOCK) {
    const store = getStore();
    const row = store.notification_preferences.find((p) => p.profile_id === profileId);
    if (!row) return null;
    const alreadyOff = !row.community_email;
    row.community_email = false;
    if (!row.community_notice_at) row.community_notice_at = new Date().toISOString();
    saveStore(store);
    return { alreadyOff };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_preferences")
    .select("community_email, community_notice_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return null;
  const { error } = await admin
    .from("notification_preferences")
    .update({ community_email: false, community_notice_at: data.community_notice_at ?? new Date().toISOString() })
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return { alreadyOff: !data.community_email };
}

/**
 * Simulació: el que fa el trigger de la 0124 en néixer un client (a la base no
 * cal cridar-la). Correu de comunitat activat i encara per dir-l'hi.
 */
export function mockNewClientPrefs(store: Store, profileId: string): void {
  if (!USE_MOCK) return;
  const row = mockRow(store, profileId);
  row.community_email = true;
  row.community_notice_at = null;
}
