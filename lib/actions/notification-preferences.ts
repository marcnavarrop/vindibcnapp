"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updatePreferences } from "@/lib/notifications/preferences";
import {
  PREFERENCE_KEYS,
  type NotificationPreferences,
} from "@/lib/notifications/preferences-defaults";

export type PrefsFormState = { error?: string; ok?: boolean };

/**
 * Desa les preferències de notificació del propi usuari (viewer). Només toca
 * les claus vàlides. Els canals WhatsApp arriben sempre desactivats des de la
 * UI (encara no funcionen).
 */
export async function updateNotificationPreferencesAction(
  _prev: PrefsFormState,
  formData: FormData,
): Promise<PrefsFormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "No autoritzat." };

  const values: Partial<NotificationPreferences> = {};
  for (const k of PREFERENCE_KEYS) values[k] = formData.get(k) === "on";

  try {
    await updatePreferences(viewer.id, values);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'han pogut desar les preferències.",
    };
  }

  revalidatePath("/client/configuracio");
  revalidatePath("/trainer/configuracio");
  revalidatePath("/admin/configuracio");
  return { ok: true };
}
