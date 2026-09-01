"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updateProfileSettings, getProfileSettings } from "@/lib/data/clients";
import type { Gender } from "@/types/database";

/**
 * Codi, no frase: Configuració es veu en tres idiomes i qui decideix el motiu
 * és el servidor. Mateix criteri que a les reserves, /prova i la comunitat.
 */
export type ProfileErrorCode =
  | "unauthorized"
  | "noName"
  | "noPhone"
  | "badHeight"
  | "badWeight"
  | "failed";

export type FormState = { errorCode?: ProfileErrorCode; ok?: boolean };

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
  if (!viewer) return { errorCode: "unauthorized" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim() || null;
  const heightCm = parseNumber(String(formData.get("heightCm") ?? ""));
  const weightKg = parseNumber(String(formData.get("weightKg") ?? ""));
  const gender = parseGender(String(formData.get("gender") ?? ""));
  const emergencyContact =
    String(formData.get("emergencyContact") ?? "").trim() || null;
  const objective = String(formData.get("objective") ?? "").trim() || null;

  if (!fullName) return { errorCode: "noName" };
  // El `required` de l'HTML no és el control: es treu des de la consola.
  if (!phone) return { errorCode: "noPhone" };
  if (heightCm !== null && (heightCm < 50 || heightCm > 260))
    return { errorCode: "badHeight" };
  if (weightKg !== null && (weightKg < 20 || weightKg > 400))
    return { errorCode: "badWeight" };

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
  } catch {
    // El missatge de la base no és per a qui mira la pantalla.
    return { errorCode: "failed" };
  }

  revalidatePath("/client/configuracio");
  revalidatePath("/client");
  return { ok: true };
}
