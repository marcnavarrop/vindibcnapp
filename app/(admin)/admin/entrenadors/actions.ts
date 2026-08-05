"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTrainer,
  updateTrainerSpecialty,
  setTrainerAvatar,
  type TrainerInput,
} from "@/lib/data/trainers";
import { uploadAvatar, validateAvatarFile } from "@/lib/data/avatars";
import type { Specialty } from "@/types/database";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

/**
 * Foto tramesa al formulari. Torna:
 *   - undefined → no s'ha tocat res (mantenir la que hi hagi)
 *   - null      → l'admin l'ha tret
 *   - File      → n'hi ha una de nova
 */
function parseAvatar(formData: FormData): File | null | undefined {
  if (formData.get("removeAvatar") === "true") return null;
  const f = formData.get("avatar");
  if (!(f instanceof File) || f.size === 0) return undefined;
  return f;
}

function parseSpecialty(formData: FormData): Specialty | null {
  const v = ((formData.get("specialty") as string | null) ?? "").trim();
  return v === "entrenador" || v === "fisioterapeuta" ? v : null;
}

export async function createTrainerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const str = (k: string) =>
    ((formData.get(k) as string | null) ?? "").trim();
  const input: TrainerInput = {
    fullName: str("fullName"),
    email: str("email"),
    specialty: parseSpecialty(formData),
  };

  if (!input.fullName) return { error: "El nom és obligatori." };
  if (!input.email) return { error: "El correu electrònic és obligatori." };
  if (!input.specialty) return { error: "Tria una especialitat." };

  // Es valida ABANS de crear el compte: si la foto no serveix, val més dir-ho
  // que quedar-se amb un entrenador creat i un error a mitges.
  const avatar = parseAvatar(formData);
  if (avatar instanceof File) {
    const check = validateAvatarFile(avatar);
    if (!check.ok) return { error: check.error };
  }

  let id: string;
  try {
    id = await createTrainer(input);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en crear l'entrenador/a.",
    };
  }

  // La foto és best-effort: l'entrenador ja existeix i es pot afegir després.
  if (avatar instanceof File) {
    try {
      await setTrainerAvatar(id, await uploadAvatar(id, avatar));
    } catch {
      // Silenci volgut: no s'ha de perdre l'alta per una foto.
    }
  }

  revalidatePath("/admin/entrenadors");
  redirect(`/admin/entrenadors?nou=${id}`);
}

export async function updateTrainerSpecialtyAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const specialty = parseSpecialty(formData);
  if (!specialty) return { error: "Tria una especialitat." };

  const avatar = parseAvatar(formData);
  if (avatar instanceof File) {
    const check = validateAvatarFile(avatar);
    if (!check.ok) return { error: check.error };
  }

  try {
    await updateTrainerSpecialty(id, specialty);
    if (avatar === null) await setTrainerAvatar(id, null);
    else if (avatar instanceof File)
      await setTrainerAvatar(id, await uploadAvatar(id, avatar));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }

  revalidatePath("/admin/entrenadors");
  redirect("/admin/entrenadors");
}
