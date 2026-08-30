"use server";

import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createClientReservation,
  cancelClientReservation,
} from "@/lib/data/reservations";
import type { ServiceType } from "@/types/database";

const SERVICE_TYPES: ServiceType[] = [
  "ep_individual",
  "ep_parejas",
  "grupo_reducido",
  "fisioterapia",
];

export type FormState = { errorCode?: ReservaErrorCode; ok?: boolean };

/**
 * Crea una reserva del propio cliente. El slot elegido determina el profesional
 * (trainer_id) y el servicio; toda la validación de negocio (bono activo del
 * tipo con sesiones, disponibilidad de ese profesional para ese servicio, fecha
 * futura, solapamiento/aforo y descuento atómico) vive en createClientReservation.
 */
export async function createOwnReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client")
    return { errorCode: "unauthorized" };

  const trainerId = String(formData.get("trainerId") ?? "");
  const serviceType = String(formData.get("serviceType") ?? "") as ServiceType;
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  if (!trainerId) return { errorCode: "noTrainer" };
  if (!SERVICE_TYPES.includes(serviceType))
    return { errorCode: "badService" };
  if (!scheduledAt) return { errorCode: "noDate" };

  try {
    await createClientReservation({
      profileId: viewer.id,
      trainerId,
      serviceType,
      scheduledAt,
    });
  } catch (e) {
    console.error("[reserves]", e);
    return { errorCode: "failed" };
  }

  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}

/** Cancela una reserva del propio cliente (futura y 'booked'). */
export async function cancelOwnReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };
  const id = String(formData.get("id") ?? "");
  if (!id) return { errorCode: "noReservation" };
  try {
    await cancelClientReservation(viewer.id, id);
  } catch (e) {
    console.error("[reserves]", e);
    return { errorCode: "failed" };
  }
  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}
