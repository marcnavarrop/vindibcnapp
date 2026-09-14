"use server";


import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { deleteAvailabilityRule } from "@/lib/data/availability";
import {
  submitAvailabilityRules,
  submitAvailabilityUpdate,
  type AvailabilityFormState,
} from "@/lib/data/availability-submit";
import { deleteAvailabilityBlock } from "@/lib/data/availability-blocks";
import {
  submitAvailabilityBlock,
  type BlockFormState,
} from "@/lib/data/availability-block-submit";

export async function createAvailabilityTrainerAction(
  prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  const res = await submitAvailabilityRules(viewer.id, formData);
  if (res.ok) revalidatePath("/trainer/disponibilitat");
  return res;
}

export async function updateAvailabilityTrainerAction(
  prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  // Quina franja es pot tocar ho decideix la RLS de la 0013 (l'admin o el seu
  // amo). Aquí només es comprova que qui demana sigui un professional; si la
  // franja no és seva, la base ho atura i l'error arriba com a missatge.
  const res = await submitAvailabilityUpdate(formData);
  if (res.ok) revalidatePath("/trainer/disponibilitat");
  return res;
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
