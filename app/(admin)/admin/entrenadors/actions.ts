"use server";

import { requireRole } from "@/lib/auth";

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

/**
 * L'error de l'alta, amb el nom, el correu i l'especialitat que s'havien
 * escrit: React 19 buida el formulari en acabar l'acció. La foto no hi torna
 * (un fitxer no es pot tornar a posar en un camp): el formulari demana que es
 * torni a triar.
 */
function keep(formData: FormData, error: string): FormState {
  const values = Object.fromEntries(
    ["fullName", "email", "specialty"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  return { error, values, at: Date.now() };
}

export async function createTrainerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Només l'admin: crea un compte de PROFESSIONAL amb la clau de servei.
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };
  const str = (k: string) =>
    ((formData.get(k) as string | null) ?? "").trim();
  const input: TrainerInput = {
    fullName: str("fullName"),
    email: str("email"),
    specialty: parseSpecialty(formData),
  };

  if (!input.fullName) return keep(formData, "El nom és obligatori.");
  if (!input.email) return keep(formData, "El correu electrònic és obligatori.");
  if (!input.specialty) return keep(formData, "Tria una especialitat.");

  // Es valida ABANS de crear el compte: si la foto no serveix, val més dir-ho
  // que quedar-se amb un entrenador creat i un error a mitges.
  const avatar = parseAvatar(formData);
  if (avatar instanceof File) {
    const check = validateAvatarFile(avatar);
    if (!check.ok) return keep(formData, check.error);
  }

  let id: string;
  try {
    id = await createTrainer(input);
  } catch (e) {
    return keep(formData, e instanceof Error ? e.message : "Error en crear el/la professional.");
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
  // Només l'admin. L'especialitat va amb la sessió (la RLS la frena), però la
  // foto s'escriu amb la clau de servei: sense això, qualsevol sessió podia
  // canviar o esborrar la foto de qualsevol perfil.
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };
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
