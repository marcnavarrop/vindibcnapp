"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createAvailabilityRules,
  updateAvailabilityRule,
  deleteAvailabilityRule,
} from "@/lib/data/availability";
import { parseServiceTypes } from "@/lib/labels";
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

export async function createAvailabilityTrainerAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;
  await createAvailabilityRules({
    trainerId: viewer.id,
    weekdays: parseWeekdays(formData),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    validFrom:
      String(formData.get("validFrom") ?? "") ||
      new Date().toISOString().slice(0, 10),
    validUntil: String(formData.get("validUntil") ?? "").trim() || null,
    serviceTypes: parseServiceTypes(formData.getAll("serviceTypes")),
  });
  revalidatePath("/trainer/disponibilitat");
}

export async function updateAvailabilityTrainerAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateAvailabilityRule(id, {
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    validFrom: String(formData.get("validFrom") ?? ""),
    validUntil: String(formData.get("validUntil") ?? "").trim() || null,
    serviceTypes: parseServiceTypes(formData.getAll("serviceTypes")),
  });
  revalidatePath("/trainer/disponibilitat");
}

export async function deleteAvailabilityTrainerAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAvailabilityRule(id);
  revalidatePath("/trainer/disponibilitat");
}

// ─────────────── Bloquejos temporals ───────────────

export async function createBlockTrainerAction(
  prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  const res = await submitAvailabilityBlock(viewer.id, viewer.id, formData);
  if (res.ok) revalidatePath("/trainer/disponibilitat");
  return res;
}

export async function deleteBlockTrainerAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAvailabilityBlock(id);
  revalidatePath("/trainer/disponibilitat");
}
