"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getPreferences, updatePreferences } from "@/lib/notifications/preferences";
import {
  PREFERENCE_KEYS,
  type NotificationPreferences,
} from "@/lib/notifications/preferences-defaults";

export type PrefsFormState = {
  error?: boolean;
  ok?: boolean;
  /**
   * Si no s'ha pogut desar: el que hi ha DE DEBÒ a la base, rellegit ara, perquè
   * el formulari torni a pintar les caselles com estan i no com les havia
   * deixat la persona en pantalla. Sense (si tampoc s'ha pogut llegir), el
   * formulari torna a les que tenia en carregar-se.
   */
  prefs?: NotificationPreferences;
  /** Canvia a cada intent fallit: força a tornar a pintar les caselles. */
  attempt?: number;
};

/**
 * Desa les preferències de notificació del propi usuari (viewer). Només toca
 * les claus vàlides.
 */
export async function updateNotificationPreferencesAction(
  _prev: PrefsFormState,
  formData: FormData,
): Promise<PrefsFormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: true };

  const values: Partial<NotificationPreferences> = {};
  for (const k of PREFERENCE_KEYS) values[k] = formData.get(k) === "on";

  try {
    await updatePreferences(viewer.id, values);
  } catch (e) {
    console.error("[preferències] no s'han pogut desar:", e);
    let prefs: NotificationPreferences | undefined;
    try {
      prefs = await getPreferences(viewer.id, { strict: true });
    } catch {
      prefs = undefined;
    }
    return { error: true, prefs, attempt: Date.now() };
  }

  revalidatePath("/client/configuracio");
  revalidatePath("/trainer/configuracio");
  revalidatePath("/admin/configuracio");
  return { ok: true };
}
