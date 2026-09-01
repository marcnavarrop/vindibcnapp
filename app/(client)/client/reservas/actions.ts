"use server";

import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createClientReservation,
  cancelClientReservation,
} from "@/lib/data/reservations";
import type { ServiceType } from "@/types/database";
import { SERVICE_TYPES } from "@/lib/labels";
import { TooLateToCancelError } from "@/lib/cancellation";


/**
 * `errorHours` acompanya el codi `tooLate`: el text diu "cal fer-ho amb almenys
 * {hours} h d'antelació", i aquest número surt de la configuració del centre,
 * que només coneix el servidor.
 */
export type FormState = {
  errorCode?: ReservaErrorCode;
  errorHours?: number;
  ok?: boolean;
};

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
    // Arribar tard NO és un error inesperat: és una regla del centre, i qui
    // la topa mereix que se li digui. Abans es tragava aquí i tornava un
    // "failed" genèric, així que el client es quedava sense saber per què.
    if (e instanceof TooLateToCancelError)
      return { errorCode: "tooLate", errorHours: e.minCancellationHours };
    console.error("[reserves]", e);
    return { errorCode: "failed" };
  }
  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}
