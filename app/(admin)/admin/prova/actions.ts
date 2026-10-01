"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  acceptTrial,
  listTrialHistoryPage,
  rejectTrial,
  setTrialFinalStatus,
} from "@/lib/data/trial-bookings";
import { toTrialRowView, type TrialRowView } from "@/lib/trial-row";
import type { TrialStatus } from "@/types/database";

/**
 * Només l'admin. Aquestes accions escriuen amb la clau de servei
 * (`acceptTrial`, `rejectTrial`, `setTrialFinalStatus`) i fins ara no miraven
 * qui les cridava: una acció de servidor es pot invocar pel seu id des de
 * qualsevol pàgina, i el middleware de /admin no la protegeix. Qualsevol
 * sessió —també la d'un client— podia acceptar, rebutjar o tancar proves.
 */
async function isAdmin(): Promise<boolean> {
  const viewer = await getViewer();
  return viewer?.role === "admin";
}

function revalidate() {
  revalidatePath("/admin/prova");
  revalidatePath("/admin/reservas");
}

/** L'admin accepta qualsevol prova pendent. */
export async function acceptTrialAdminAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (id) await acceptTrial(id, null);
  revalidate();
}

/** L'admin rebutja qualsevol prova (allibera el forat). */
export async function rejectTrialAdminAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (id) await rejectTrial(id, null);
  revalidate();
}

const FINAL: TrialStatus[] = ["completed", "no_show", "cancelled"];

/** Marca una prova com a completada / no presentat / cancel·lada. */
export async function setTrialStatusAdminAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as TrialStatus;
  if (!id || !FINAL.includes(status)) return;
  await setTrialFinalStatus(
    id,
    status as "completed" | "no_show" | "cancelled",
  );
  revalidate();
}

export type LoadMoreTrialsResult =
  | { ok: true; items: TrialRowView[]; nextCursor: string | null }
  | { ok: false; error: string };

/** «Carregar més» de l'històric de proves. Només admin. */
export async function loadMoreTrialsAction(cursor: string): Promise<LoadMoreTrialsResult> {
  if (!(await isAdmin())) return { ok: false, error: "No autoritzat." };
  try {
    const page = await listTrialHistoryPage({ cursor });
    return { ok: true, items: page.items.map(toTrialRowView), nextCursor: page.nextCursor };
  } catch (e) {
    console.error("[proves] carregar més:", e);
    return { ok: false, error: "No s'han pogut carregar més proves. Torna-ho a provar." };
  }
}
