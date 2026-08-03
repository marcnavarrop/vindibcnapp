"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createReservation,
  cancelReservation,
  completeReservation,
  rescheduleReservation,
} from "@/lib/data/reservations";
import { datetimeLocalToInstant } from "@/lib/center-time";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export async function createReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const bonoId = String(formData.get("bonoId") ?? "");
  const trainerId = String(formData.get("trainerId") ?? "") || null;
  const raw = String(formData.get("scheduledAt") ?? "");
  const repeatWeeks = Number(formData.get("repeatWeeks")) || 1;

  if (!bonoId) return { error: "Tria un bo." };
  if (!raw) return { error: "Indica la data i hora." };
  if (repeatWeeks < 1 || repeatWeeks > 52)
    return { error: "Les repeticions han d'estar entre 1 i 52." };

  // L'hora que s'escriu al panell és hora del centre, no del servidor.
  const date = datetimeLocalToInstant(raw);
  if (!date) return { error: "La data no és vàlida." };

  try {
    await createReservation(
      {
        bonoId,
        trainerId,
        scheduledAt: date.toISOString(),
      },
      repeatWeeks,
    );
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
