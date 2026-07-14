"use server";

import { revalidatePath } from "next/cache";
import {
  acceptTrial,
  rejectTrial,
  setTrialFinalStatus,
} from "@/lib/data/trial-bookings";
import type { TrialStatus } from "@/types/database";

function revalidate() {
  revalidatePath("/admin/prova");
  revalidatePath("/admin/reservas");
}

/** L'admin accepta qualsevol prova pendent. */
export async function acceptTrialAdminAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await acceptTrial(id, null);
  revalidate();
}

/** L'admin rebutja qualsevol prova (allibera el forat). */
export async function rejectTrialAdminAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await rejectTrial(id, null);
  revalidate();
}

const FINAL: TrialStatus[] = ["completed", "no_show", "cancelled"];

/** Marca una prova com a completada / no presentat / cancel·lada. */
export async function setTrialStatusAdminAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as TrialStatus;
  if (!id || !FINAL.includes(status)) return;
  await setTrialFinalStatus(
    id,
    status as "completed" | "no_show" | "cancelled",
  );
  revalidate();
}
