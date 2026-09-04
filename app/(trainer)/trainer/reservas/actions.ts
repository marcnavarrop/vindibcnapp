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

/** Cancela una reserva (RLS: solo de sus clientes asignados). */
export async function cancelTrainerReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await cancelReservation(id);
  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
}

/** Marca una reserva como realizada (RLS: solo de sus clientes asignados). */
export async function completeTrainerReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await completeReservation(id);
  revalidatePath("/trainer/reservas");
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
