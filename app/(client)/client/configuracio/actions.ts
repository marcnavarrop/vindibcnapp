"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updateProfileSettings } from "@/lib/data/clients";
import type { PreferredLanguage } from "@/types/database";

export type FormState = { error?: string; ok?: boolean };

function parseLanguage(v: string): PreferredLanguage {
  return v === "es" || v === "en" ? v : "ca";
}

/**
 * Actualiza el propio perfil del cliente (nombre, teléfono e idioma).
 * El email no se edita (es el de login). Valida que solo se modifica el
 * perfil del usuario autenticado.
 */
export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "No autoritzat." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const preferredLanguage = parseLanguage(
    String(formData.get("preferredLanguage") ?? "ca"),
  );

  if (!fullName) return { error: "El nom és obligatori." };

  try {
    await updateProfileSettings(viewer.id, {
      fullName,
      phone: phone || null,
      preferredLanguage,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'han pogut desar els canvis.",
    };
  }

  revalidatePath("/client/configuracio");
  revalidatePath("/client");
  return { ok: true };
}
