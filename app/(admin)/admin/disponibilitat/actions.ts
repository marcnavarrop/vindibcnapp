"use server";

import { revalidatePath } from "next/cache";
import {
  createAvailabilityRules,
  updateAvailabilityRule,
  deleteAvailabilityRule,
} from "@/lib/data/availability";
import { parseServiceTypes } from "@/lib/labels";

function parseWeekdays(formData: FormData): number[] {
  return formData
    .getAll("weekdays")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/** Crea disponibilidad para el entrenador `trainerId` (admin). */
export async function createAvailabilityAdminAction(
  trainerId: string,
  formData: FormData,
) {
  await createAvailabilityRules({
    trainerId,
    weekdays: parseWeekdays(formData),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    validFrom:
      String(formData.get("validFrom") ?? "") ||
      new Date().toISOString().slice(0, 10),
    validUntil: String(formData.get("validUntil") ?? "").trim() || null,
    serviceTypes: parseServiceTypes(formData.getAll("serviceTypes")),
  });
  revalidatePath("/admin/disponibilitat");
}

export async function updateAvailabilityAdminAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateAvailabilityRule(id, {
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    validFrom: String(formData.get("validFrom") ?? ""),
    validUntil: String(formData.get("validUntil") ?? "").trim() || null,
    serviceTypes: parseServiceTypes(formData.getAll("serviceTypes")),
  });
  revalidatePath("/admin/disponibilitat");
}

export async function deleteAvailabilityAdminAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAvailabilityRule(id);
  revalidatePath("/admin/disponibilitat");
}
