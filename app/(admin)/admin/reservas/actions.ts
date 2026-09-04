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

export async function cancelReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await cancelReservation(id);
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/bonos");
}

export async function completeReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await completeReservation(id);
  revalidatePath("/admin/reservas");
}

export async function rescheduleReservationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("scheduledAt") ?? "");
  const date = datetimeLocalToInstant(raw);
  if (!id || !date) return;
  await rescheduleReservation(id, date.toISOString());
  revalidatePath("/admin/reservas");
}
