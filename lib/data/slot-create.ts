import "server-only";
import { createReservation } from "@/lib/data/reservations";
import { pickUsableBono } from "@/lib/data/slot-booking";
import { actionError, type ReservationActionState } from "@/lib/reservation-action-state";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

/**
 * Crea una reserva a un forat (o apunta un client a un grup amb places) per a
 * `trainerId`. La comparteixen el professional —a la seva agenda, sempre ell—
 * i l'admin —el professional de la columna—; qui crida ja ha mirat el rol.
 *
 * El bo no el tria la pantalla: és el més antic utilitzable del servei
 * (`pickUsableBono`), el mateix que la fulla ensenyava. Sense bo, només si es
 * marca «cortesia».
 *
 * Tota la resta —permís sobre el client, disponibilitat, bloquejos, ocupació,
 * aforament i pany— ho fa `createReservation`, com des del formulari. Si
 * mentrestant algú ha agafat el forat, l'error torna aquí i la fulla el pinta.
 */
export async function bookFromSlot(
  formData: FormData,
  trainerId: string,
): Promise<ReservationActionState> {
  const clientId = String(formData.get("clientId") ?? "");
  const serviceType = String(formData.get("serviceType") ?? "") as ServiceType;
  const at = new Date(String(formData.get("at") ?? ""));
  const courtesy = formData.get("courtesy") === "on";
  if (!clientId) return { error: "Tria un client." };
  if (!SERVICE_TYPES.includes(serviceType)) return { error: "Tria un servei." };
  if (Number.isNaN(at.getTime())) return { error: "L'hora no és vàlida." };
  if (at.getTime() <= Date.now()) return { error: "Aquesta hora ja ha passat." };

  try {
    if (courtesy) {
      await createReservation({
        trainerId,
        scheduledAt: at.toISOString(),
        bonoId: null,
        clientId,
        serviceType,
      });
    } else {
      const bono = await pickUsableBono(clientId, serviceType);
      if (!bono)
        return {
          error: `Aquest client no té cap bo de ${SERVICE_LABELS[serviceType]} amb sessions. Pots crear-la com a sessió de cortesia.`,
        };
      await createReservation({
        trainerId,
        scheduledAt: at.toISOString(),
        bonoId: bono.id,
      });
    }
  } catch (e) {
    return actionError(e, "No s'ha pogut crear la reserva.");
  }
  return { ok: true };
}
