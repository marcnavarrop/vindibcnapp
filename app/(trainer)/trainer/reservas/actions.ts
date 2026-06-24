"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createReservation,
  cancelReservation,
  completeReservation,
} from "@/lib/data/reservations";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

/**
 * Crea una reserva desde el área de entrenador/a. La RLS garantiza que solo
 * puede hacerlo para sus clientes asignados (reservations_trainer_write).
 */
export async function createTrainerReservationAction(
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

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { error: "La data no és vàlida." };

  try {
    await createReservation(
      { bonoId, trainerId, scheduledAt: date.toISOString() },
      repeatWeeks,
    );
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
