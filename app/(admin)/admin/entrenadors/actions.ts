"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTrainer,
  updateTrainerSpecialty,
  type TrainerInput,
} from "@/lib/data/trainers";
import type { Specialty } from "@/types/database";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

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

  let id: string;
  try {
    id = await createTrainer(input);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en crear l'entrenador/a.",
    };
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

  try {
    await updateTrainerSpecialty(id, specialty);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }

  revalidatePath("/admin/entrenadors");
  redirect("/admin/entrenadors");
}
