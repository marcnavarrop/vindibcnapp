"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updateCenterSettings } from "@/lib/data/center-settings";

export type CenterSettingsState = { error?: string; ok?: boolean };

export async function updateCenterSettingsAction(
  _prev: CenterSettingsState,
  fd: FormData,
): Promise<CenterSettingsState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const raw = fd.get("minCancellationHours") as string;
  const hours = parseInt(raw, 10);
  if (isNaN(hours) || hours < 0)
    return { error: "El valor ha de ser un nombre enter positiu (o 0 per desactivar)." };
  if (hours > 168)
    return { error: "El límit màxim és 168 hores (7 dies)." };

  try {
    await updateCenterSettings({ minCancellationHours: hours });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en desar la configuració.",
    };
  }

  revalidatePath("/admin/configuracio");
  return { ok: true };
}
