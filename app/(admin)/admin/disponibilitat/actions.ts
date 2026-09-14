"use server";


import { revalidatePath } from "next/cache";
import { deleteAvailabilityRule } from "@/lib/data/availability";
import {
  submitAvailabilityRules,
  submitAvailabilityUpdate,
  type AvailabilityFormState,
} from "@/lib/data/availability-submit";
import { getViewer } from "@/lib/auth";
import { deleteAvailabilityBlock } from "@/lib/data/availability-blocks";
import {
  submitAvailabilityBlock,
  type BlockFormState,
} from "@/lib/data/availability-block-submit";

/** Crea disponibilidad para el entrenador `trainerId` (admin). */
export async function createAvailabilityAdminAction(
  trainerId: string,
  prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };
  const res = await submitAvailabilityRules(trainerId, formData);
  if (res.ok) revalidatePath("/admin/disponibilitat");
  return res;
}

export async function updateAvailabilityAdminAction(
  prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };
  const res = await submitAvailabilityUpdate(formData);
  if (res.ok) revalidatePath("/admin/disponibilitat");
  return res;
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
