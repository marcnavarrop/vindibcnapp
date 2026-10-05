import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { mockFails } from "@/lib/mock/faults";
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_KEYS,
  type NotificationPreferences,
  type PersistedPreferenceKey,
} from "@/lib/notifications/preferences-defaults";

function rowToPrefs(row: Record<string, unknown> | null): NotificationPreferences {
  const out = { ...DEFAULT_PREFERENCES };
  if (row)
    for (const k of PREFERENCE_KEYS)
      if (typeof row[k] === "boolean") out[k] = row[k] as boolean;
  return out;
}

/**
 * Preferències d'un perfil (defaults si encara no té fila).
 *
 * `strict`: si la lectura falla, llança en comptes de tornar els defaults. El
 * camí normal (pantalles i `notify()`) es queda com era; el fa servir qui ha de
 * saber què hi ha DE DEBÒ a la base, com el formulari després d'un error en
 * desar: ensenyar-hi els defaults seria pintar unes caselles que no són les
 * desades.
 */
export async function getPreferences(
  profileId: string,
  opts?: { strict?: boolean },
): Promise<NotificationPreferences> {
  if (opts?.strict && mockFails("prefs-read")) throw new Error("error simulat (MOCK_FAIL=prefs-read)");
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
  const { data, error } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error && opts?.strict) throw new Error(error.message);
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
  // Només claus vàlides (mai canals que no existeixin, ni els avisos que
  // s'envien sempre i no tenen columna a BD).
  const clean: Partial<Record<PersistedPreferenceKey, boolean>> = {};
  for (const k of PREFERENCE_KEYS)
    if (typeof values[k] === "boolean") clean[k] = values[k];

  // Per provar què ensenya la pantalla quan la base falla (MOCK_FAIL=prefs).
  if (mockFails("prefs")) throw new Error("error simulat (MOCK_FAIL=prefs)");

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

  /*
   * L'error es MIRA. Abans no: si l'upsert fallava (una columna que encara no
   * hi era, la base caiguda), el botó deia «Preferències desades» i el canvi es
   * perdia sense que ningú se n'adonés.
   */
  const admin = createAdminClient();
  const { error } = await admin
    .from("notification_preferences")
    .upsert(
      { profile_id: profileId, ...clean },
      { onConflict: "profile_id" },
    );
  if (error) throw new Error(error.message);
}
