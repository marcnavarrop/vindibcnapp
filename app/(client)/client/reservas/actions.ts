"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createClientReservation,
  cancelClientReservation,
} from "@/lib/data/reservations";

export type FormState = { error?: string; ok?: boolean };

/**
 * Crea una reserva del propio cliente. Toda la validación de negocio
 * (propiedad del bono, servicio, entrenador asignado, fecha futura,
 * solapamiento/aforo y descuento atómico) vive en createClientReservation.
 */
export async function createOwnReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client")
    return { error: "No autoritzat." };

  const bonoId = String(formData.get("bonoId") ?? "");
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  if (!bonoId) return { error: "Tria un bo." };
  if (!scheduledAt) return { error: "Indica la data i hora." };

  try {
    await createClientReservation({
      profileId: viewer.id,
      bonoId,
      scheduledAt,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut crear la reserva.",
    };
  }

  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}

/** Cancela una reserva del propio cliente (futura y 'booked'). */
export async function cancelOwnReservationAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await cancelClientReservation(viewer.id, id);
  } catch {
    // La UI ya valida; un fallo aquí (p. ej. reserva ya pasada) se ignora.
  }
  revalidatePath("/client/reservas");
  revalidatePath("/client");
}
