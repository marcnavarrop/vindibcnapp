"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  type ReservationActionState,
} from "@/lib/reservation-action-state";
import { redirect } from "next/navigation";
import {
  createReservation,
  cancelReservation,
  completeReservation,
  rescheduleReservation,
} from "@/lib/data/reservations";
import { parseReservationForm } from "@/lib/data/reservation-input";
import { datetimeLocalToInstant } from "@/lib/center-time";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export async function createReservationAction(
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
    return { error: e instanceof Error ? e.message : "Error en crear la reserva." };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/admin/bonos");
  redirect("/admin/reservas");
}

/**
 * Cancel·la una reserva. Torna l'estat en comptes de llançar: la pantalla
 * espera la resposta per dir si s'ha fet (vegeu `lib/reservation-action-state`).
 */
export async function cancelReservationAction(
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
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/bonos");
  return { ok: true };
}

export async function completeReservationAction(
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
  revalidatePath("/admin/reservas");
  return { ok: true };
}

export async function rescheduleReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("scheduledAt") ?? "");
  const date = datetimeLocalToInstant(raw);
  if (!id || !date) return;
  await rescheduleReservation(id, date.toISOString());
  revalidatePath("/admin/reservas");
}
