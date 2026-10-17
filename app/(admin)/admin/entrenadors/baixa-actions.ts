"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  BaixaError,
  deactivateProfessional,
  getBaixaImpact,
  reactivateProfessional,
} from "@/lib/data/professional-deactivation";
import { preModeBlocksPersonalData } from "@/lib/pre-mode";

export type BaixaState = { error?: string };

export type ReactivateState = { error?: string; ok?: boolean; warning?: string };

// El mateix fre que la baixa RGPD d'un client, i pel mateix motiu: deixa
// constància a `data_access_log` i bloqueja un compte. Amb el mode PRE armat no
// es fa. Vegeu lib/pre-mode.ts.
const PRE_BLOCKED =
  "Mode PRE actiu. La baixa i la reactivació d'un professional no es fan en mode de proves. " +
  "Apaga el mode PRE a Configuració i torna-ho a provar.";

/**
 * Dona de baixa (desactiva) un professional (0128). Doble confirmació: cal
 * escriure el seu nom exacte. Tot el que en depèn ho resol
 * `deactivateProfessional`; aquí només es comprova qui crida i què ha triat.
 */
export async function deactivateProfessionalAction(
  id: string,
  _prev: BaixaState,
  formData: FormData,
): Promise<BaixaState> {
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };
  if (await preModeBlocksPersonalData()) return { error: PRE_BLOCKED };

  const impact = await getBaixaImpact(id);
  if (!impact) return { error: "Professional no trobat." };
  const name = impact.professional.fullName;

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed.toLowerCase() !== name.trim().toLowerCase())
    return { error: "El nom introduït no coincideix amb el del professional." };

  const raw = String(formData.get("reassignTo") ?? "").trim();
  const reassignTo = raw && raw !== "none" ? raw : null;
  // Si té clients, la tria ha de ser explícita: «sense professional» també ho és.
  if (impact.clients.length > 0 && !raw)
    return { error: "Tria a qui passen els seus clients (o «Sense professional»)." };

  try {
    await deactivateProfessional({ id, actorId: viewer.id, reassignTo });
  } catch (e) {
    return {
      error:
        e instanceof BaixaError || e instanceof Error
          ? e.message
          : "No s'ha pogut donar de baixa el professional.",
    };
  }

  revalidatePath("/admin/entrenadors");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/reservas");
  // La mateixa pàgina, ja de baixa, diu què s'ha fet (ho llegeix del registre):
  // un resum a l'estat del formulari es perdia en refrescar-se la pàgina.
  redirect(`/admin/entrenadors/${id}/baixa`);
}

/** Reactiva un professional donat de baixa. */
export async function reactivateProfessionalAction(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: ReactivateState,
): Promise<ReactivateState> {
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };
  if (await preModeBlocksPersonalData()) return { error: PRE_BLOCKED };
  let warnings: string[];
  try {
    ({ warnings } = await reactivateProfessional({ id, actorId: viewer.id }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No s'ha pogut reactivar." };
  }
  revalidatePath("/admin/entrenadors");
  return { ok: true, warning: warnings.join(" ") || undefined };
}
