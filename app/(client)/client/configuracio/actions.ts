"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updateProfileSettings, getProfileSettings } from "@/lib/data/clients";
import type { Gender } from "@/types/database";

export type FormState = { error?: string; ok?: boolean };

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
    // L'idioma NO surt d'aquest formulari: el canvia el seu propi selector, que
    // escriu perfil i cookie alhora. Es torna a llegir i es reenvia tal com
    // està perquè `updateProfileSettings` escriu la fila sencera: sense això,
    // desar el nom o el telèfon tornaria l'idioma al català i desfaria la tria.
    const current = await getProfileSettings(viewer.id);

    await updateProfileSettings(viewer.id, {
      fullName,
      phone: phone || null,
      preferredLanguage: current?.preferredLanguage ?? "ca",
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
