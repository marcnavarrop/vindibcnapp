"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createReservation,
  cancelReservation,
  completeReservation,
} from "@/lib/data/reservations";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export async function createReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const bonoId = String(formData.get("bonoId") ?? "");
  const trainerId = String(formData.get("trainerId") ?? "") || null;
  const raw = String(formData.get("scheduledAt") ?? "");

  if (!bonoId) return { error: "Tria un bo." };
  if (!raw) return { error: "Indica la data i hora." };

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { error: "La data no és vàlida." };

  try {
    await createReservation({
      bonoId,
      trainerId,
      scheduledAt: date.toISOString(),
    });
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
