"use server";


import { revalidatePath } from "next/cache";
import {
  submitAvailabilityRules,
  submitAvailabilityUpdate,
  submitAvailabilityDelete,
  type AvailabilityFormState,
} from "@/lib/data/availability-submit";
import { getViewer } from "@/lib/auth";
import { deleteAvailabilityBlock } from "@/lib/data/availability-blocks";
import {
  submitAvailabilityBlock,
  type BlockFormState,
} from "@/lib/data/availability-block-submit";
import {
  cancelOrphans,
  selectionFromForm,
  outcomeSummary,
} from "@/lib/data/availability-orphans";
import type { OrphansPanelState } from "@/components/orphans-panel";

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
  const res = await submitAvailabilityUpdate(formData, { role: "admin" });
  if (res.ok) revalidatePath("/admin/disponibilitat");
  return res;
}

export async function deleteAvailabilityAdminAction(
  prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };
  const res = await submitAvailabilityDelete(formData, { role: "admin" });
  if (res.ok) revalidatePath("/admin/disponibilitat");
  return res;
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
  const res = await submitAvailabilityBlock(trainerId, viewer.id, formData, {
    role: "admin",
  });
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

// ─────────────── Reserves fora de disponibilitat ───────────────

/** El plafó: l'admin cancel·la el que s'ha marcat de l'agenda triada. */
export async function cancelOrphansAdminAction(
  trainerId: string,
  prev: OrphansPanelState,
  formData: FormData,
): Promise<OrphansPanelState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };
  const sel = selectionFromForm(formData);
  if (!sel.reservationIds.length && !sel.trialIds.length && !sel.waitlistIds.length)
    return { error: "No has marcat res." };
  const res = outcomeSummary(await cancelOrphans(trainerId, null, sel));
  revalidatePath("/admin/disponibilitat");
  return { notice: res.notice ?? undefined, error: res.warning ?? undefined };
}
