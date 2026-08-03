"use server";

import { centerToday } from "@/lib/center-time";

import { revalidatePath } from "next/cache";
import {
  createAvailabilityRules,
  updateAvailabilityRule,
  deleteAvailabilityRule,
} from "@/lib/data/availability";
import { parseServiceTypes } from "@/lib/labels";
import { getViewer } from "@/lib/auth";
import { deleteAvailabilityBlock } from "@/lib/data/availability-blocks";
import {
  submitAvailabilityBlock,
  type BlockFormState,
} from "@/lib/data/availability-block-submit";

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
      String(formData.get("validFrom") ?? "") || centerToday(),
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

// ─────────────── Bloquejos temporals ───────────────

/** L'admin crea el bloqueig per al trainer seleccionat (bind del primer arg). */
export async function createBlockAdminAction(
  trainerId: string,
  prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };
  const res = await submitAvailabilityBlock(trainerId, viewer.id, formData);
  if (res.ok) revalidatePath("/admin/disponibilitat");
  return res;
}

export async function deleteBlockAdminAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return;
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAvailabilityBlock(id);
  revalidatePath("/admin/disponibilitat");
}
