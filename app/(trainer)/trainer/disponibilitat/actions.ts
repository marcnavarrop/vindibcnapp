"use server";


import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  submitAvailabilityRules,
  submitAvailabilityUpdate,
  submitAvailabilityDelete,
  type AvailabilityFormState,
} from "@/lib/data/availability-submit";
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
  // Només les franges pròpies: ho comprova `submitAvailabilityUpdate` abans de
  // llegir les reserves afectades, i la RLS de la 0013 ho torna a mirar en desar.
  const res = await submitAvailabilityUpdate(formData, {
    role: "trainer",
    id: viewer.id,
  });
  if (res.ok) revalidatePath("/trainer/disponibilitat");
  return res;
}

export async function deleteAvailabilityTrainerAction(
  prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  const res = await submitAvailabilityDelete(formData, {
    role: "trainer",
    id: viewer.id,
  });
  if (res.ok) revalidatePath("/trainer/disponibilitat");
  return res;
}

// ─────────────── Bloquejos temporals ───────────────

export async function createBlockTrainerAction(
  prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  const res = await submitAvailabilityBlock(viewer.id, viewer.id, formData, {
    role: "trainer",
    id: viewer.id,
  });
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

// ─────────────── Reserves fora de disponibilitat ───────────────

/** El plafó: cancel·la el que s'ha marcat de la PRÒPIA agenda. */
export async function cancelOrphansTrainerAction(
  prev: OrphansPanelState,
  formData: FormData,
): Promise<OrphansPanelState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  const sel = selectionFromForm(formData);
  if (!sel.reservationIds.length && !sel.trialIds.length && !sel.waitlistIds.length)
    return { error: "No has marcat res." };
  const res = outcomeSummary(await cancelOrphans(viewer.id, viewer.id, sel));
  revalidatePath("/trainer/disponibilitat");
  return { notice: res.notice ?? undefined, error: res.warning ?? undefined };
}
