import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_KEYS,
  type NotificationPreferences,
  type PreferenceKey,
} from "@/lib/notifications/preferences-defaults";

function rowToPrefs(row: Record<string, unknown> | null): NotificationPreferences {
  const out = { ...DEFAULT_PREFERENCES };
  if (row)
    for (const k of PREFERENCE_KEYS)
      if (typeof row[k] === "boolean") out[k] = row[k] as boolean;
  return out;
}

/** Preferències d'un perfil (defaults si encara no té fila). */
export async function getPreferences(
  profileId: string,
): Promise<NotificationPreferences> {
  if (USE_MOCK) {
    const store = getStore();
    let row = store.notification_preferences.find(
      (p) => p.profile_id === profileId,
    );
    if (!row) {
      // Crea la fila amb defaults (equivalent al trigger a BD).
      row = {
        id: `np-${profileId}`,
        profile_id: profileId,
        ...DEFAULT_PREFERENCES,
        created_at: new Date().toISOString(),
      } as (typeof store.notification_preferences)[number];
      store.notification_preferences.push(row);
      saveStore(store);
    }
    return rowToPrefs(row as unknown as Record<string, unknown>);
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) {
    // Xarxa de seguretat si faltés la fila (el trigger normalment la crea).
    await admin
      .from("notification_preferences")
      .insert({ profile_id: profileId })
      .then(() => undefined, () => undefined);
    return { ...DEFAULT_PREFERENCES };
  }
  return rowToPrefs(data as unknown as Record<string, unknown>);
}

/** Actualitza (upsert) les preferències d'un perfil. */
export async function updatePreferences(
  profileId: string,
  values: Partial<NotificationPreferences>,
): Promise<void> {
  // Només claus vàlides (mai canals que no existeixin).
  const clean: Partial<NotificationPreferences> = {};
  for (const k of PREFERENCE_KEYS)
    if (typeof values[k] === "boolean") clean[k] = values[k];

  if (USE_MOCK) {
    const store = getStore();
    let row = store.notification_preferences.find(
      (p) => p.profile_id === profileId,
    );
    if (!row) {
      row = {
        id: `np-${profileId}`,
        profile_id: profileId,
        ...DEFAULT_PREFERENCES,
        created_at: new Date().toISOString(),
      } as (typeof store.notification_preferences)[number];
      store.notification_preferences.push(row);
    }
    Object.assign(row, clean);
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("notification_preferences")
    .upsert(
      { profile_id: profileId, ...clean },
      { onConflict: "profile_id" },
    );
}

/** Comprova si un canal concret està habilitat per a un esdeveniment. */
export function isChannelEnabled(
  prefs: NotificationPreferences,
  key: PreferenceKey,
): boolean {
  return prefs[key] === true;
}
