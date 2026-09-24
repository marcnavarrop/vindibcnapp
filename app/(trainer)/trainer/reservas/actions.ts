"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createReservation,
  cancelReservation,
  completeReservation,
  rescheduleReservation,
} from "@/lib/data/reservations";
import { parseReservationForm } from "@/lib/data/reservation-input";
import { acceptTrial, rejectTrial } from "@/lib/data/trial-bookings";
import { datetimeLocalToInstant } from "@/lib/center-time";
import { getViewer } from "@/lib/auth";
import {
  actionError,
  type ReservationActionState,
} from "@/lib/reservation-action-state";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

/**
 * Crea una reserva desde el área de entrenador/a. La RLS garantiza que solo
 * puede hacerlo para sus clientes asignados (reservations_trainer_write).
 */
export async function createTrainerReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // El parseig viu a `lib/data/reservation-input.ts`: aquesta acció i la del
  // seu company eren dues còpies del mateix, i amb la cortesia haurien passat
  // a ser dues còpies més llargues.
  const parsed = parseReservationForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await createReservation(parsed.input, parsed.repeatWeeks);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en crear la reserva.",
    };
  }

  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
  redirect("/trainer/reservas");
}

/**
 * Cancel·la una reserva: les dels seus clients assignats i qualsevol de la seva
 * agenda (0091). Qui ho decideix és `cancel_reservation`, a la base. Torna
 * l'estat en comptes de llançar: la pantalla espera la resposta.
 */
export async function cancelTrainerReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta la reserva." };
  try {
    await cancelReservation(id);
  } catch (e) {
    return actionError(e, "No s'ha pogut cancel·lar la reserva.");
  }
  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
  return { ok: true };
}

/** Marca una reserva com a feta (RLS: només dels seus clients assignats). */
export async function completeTrainerReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta la reserva." };
  try {
    await completeReservation(id);
  } catch (e) {
    return actionError(e, "No s'ha pogut marcar com a feta.");
  }
  revalidatePath("/trainer/reservas");
  return { ok: true };
}

/** Reprograma una reserva propia (RLS: solo de sus clientes asignados). */
export async function rescheduleTrainerReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("scheduledAt") ?? "");
  const date = datetimeLocalToInstant(raw);
  if (!id || !date) return;
  await rescheduleReservation(id, date.toISOString());
  revalidatePath("/trainer/reservas");
}

/** Accepta una sessió de prova pròpia (queda confirmada). */
export async function acceptTrialTrainerAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;
  const id = String(formData.get("id") ?? "");
  if (id) await acceptTrial(id, viewer.id);
  revalidatePath("/trainer/reservas");
}

/** Rebutja una sessió de prova pròpia (allibera el forat). */
export async function rejectTrialTrainerAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;
  const id = String(formData.get("id") ?? "");
  if (id) await rejectTrial(id, viewer.id);
  revalidatePath("/trainer/reservas");
}
