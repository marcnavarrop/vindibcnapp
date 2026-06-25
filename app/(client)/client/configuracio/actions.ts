"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updateProfileSettings } from "@/lib/data/clients";
import type { PreferredLanguage, Gender } from "@/types/database";

export type FormState = { error?: string; ok?: boolean };

function parseLanguage(v: string): PreferredLanguage {
  return v === "es" || v === "en" ? v : "ca";
}

function parseGender(v: string): Gender | null {
  return v === "home" || v === "dona" || v === "altre" || v === "ns_nc"
    ? v
    : null;
}

function parseNumber(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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
  const birthDate = String(formData.get("birthDate") ?? "").trim() || null;
  const heightCm = parseNumber(String(formData.get("heightCm") ?? ""));
  const weightKg = parseNumber(String(formData.get("weightKg") ?? ""));
  const gender = parseGender(String(formData.get("gender") ?? ""));
  const emergencyContact =
    String(formData.get("emergencyContact") ?? "").trim() || null;
  const objective = String(formData.get("objective") ?? "").trim() || null;

  if (!fullName) return { error: "El nom és obligatori." };
  if (heightCm !== null && (heightCm < 50 || heightCm > 260))
    return { error: "L'alçada ha d'estar entre 50 i 260 cm." };
  if (weightKg !== null && (weightKg < 20 || weightKg > 400))
    return { error: "El pes ha d'estar entre 20 i 400 kg." };

  try {
    await updateProfileSettings(viewer.id, {
      fullName,
      phone: phone || null,
      preferredLanguage,
      birthDate,
      heightCm,
      weightKg,
      gender,
      emergencyContact,
      objective,
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
