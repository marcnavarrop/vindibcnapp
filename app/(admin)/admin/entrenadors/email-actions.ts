"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  cancelEmailChange,
  requestEmailChangeByAdmin,
  type EmailChangeError,
} from "@/lib/data/email-change";

export type TrainerEmailState = { error?: string; sentTo?: string };

const MESSAGES: Record<EmailChangeError, string> = {
  invalid: "Aquest correu no sembla vàlid.",
  same: "És el correu que ja té.",
  taken: "Aquest correu ja el fa servir un altre compte del centre.",
  wrongPassword: "No autoritzat.",
  noAccount: "Aquest professional no té compte d'accés.",
  tooSoon: "Fa menys de 5 minuts que s'ha enviat un enllaç. Espera una mica abans de tornar-ho a provar.",
  failed: "No s'ha pogut enviar el correu de confirmació. Torna-ho a provar d'aquí a una estona.",
  unauthorized: "No autoritzat.",
  notTrainer: "Només es pot canviar així el correu d'un professional.",
  demo: "En mode demo no hi ha comptes reals: el correu no es canvia.",
};

/**
 * L'admin demana canviar el correu d'accés d'un professional. S'envia un
 * enllaç NOMÉS al correu nou; el canvi el fa el professional en confirmar-lo.
 * Vegeu `requestEmailChangeByAdmin`.
 */
export async function requestTrainerEmailChangeAction(
  trainerId: string,
  _prev: TrainerEmailState,
  formData: FormData,
): Promise<TrainerEmailState> {
  if (!(await requireRole("admin"))) return { error: MESSAGES.unauthorized };
  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();
  const error = await requestEmailChangeByAdmin({ profileId: trainerId, newEmail });
  if (error) return { error: MESSAGES[error] };
  revalidatePath(`/admin/entrenadors/${trainerId}/edit`);
  return { sentTo: newEmail };
}

export type CancelTrainerEmailState = { cancelled?: boolean; error?: string; attempt?: number };

/**
 * Anul·la l'enllaç pendent: el que s'hagi enviat deixa de valer.
 *
 * Si la base falla, es diu, i la fitxa segueix ensenyant el canvi com a
 * pendent (no es revalida): l'enllaç encara val.
 */
export async function cancelTrainerEmailChangeAction(
  trainerId: string,
): Promise<CancelTrainerEmailState> {
  if (!(await requireRole("admin"))) return { error: MESSAGES.unauthorized, attempt: Date.now() };
  if (!trainerId) return { error: "Professional no indicat.", attempt: Date.now() };
  try {
    await cancelEmailChange(trainerId);
  } catch (e) {
    console.error("[canvi de correu] no s'ha pogut anul·lar:", e);
    return {
      error: "No s'ha pogut anul·lar l'enllaç: encara és vàlid. Torna-ho a provar d'aquí a una estona.",
      attempt: Date.now(),
    };
  }
  revalidatePath(`/admin/entrenadors/${trainerId}/edit`);
  return { cancelled: true };
}
