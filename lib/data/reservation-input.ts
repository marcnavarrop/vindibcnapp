import "server-only";
import { datetimeLocalToInstant } from "@/lib/center-time";
import { SERVICE_TYPES } from "@/lib/labels";
import type { ReservationInput } from "@/lib/data/reservations";
import type { ServiceType } from "@/types/database";

/**
 * Llegeix el formulari de nova reserva.
 *
 * Viu fora de les dues Server Actions —la de l'admin i la del professional—
 * perquè eren dues còpies gairebé idèntiques del mateix parseig. Amb la
 * cortesia passaven a ser dues còpies de quelcom bastant més llarg, i el dia
 * que una validació canviés només se n'arreglaria una. Mateix criteri que
 * `completedSessions`.
 */
export type ParsedReservation =
  | { ok: true; input: ReservationInput; repeatWeeks: number }
  | { ok: false; error: string };

export function parseReservationForm(formData: FormData): ParsedReservation {
  const complimentary = formData.get("complimentary") === "on";
  const clientId = String(formData.get("clientId") ?? "");
  const bonoId = String(formData.get("bonoId") ?? "");
  const serviceType = String(formData.get("serviceType") ?? "");
  const trainerId = String(formData.get("trainerId") ?? "") || null;
  const raw = String(formData.get("scheduledAt") ?? "");
  const repeatWeeks = Number(formData.get("repeatWeeks")) || 1;

  if (!raw) return { ok: false, error: "Indica la data i hora." };
  if (repeatWeeks < 1 || repeatWeeks > 52)
    return { ok: false, error: "Les repeticions han d'estar entre 1 i 52." };

  // L'hora que s'escriu al panell és hora del centre, no del servidor.
  const date = datetimeLocalToInstant(raw);
  if (!date) return { ok: false, error: "La data no és vàlida." };
  const scheduledAt = date.toISOString();

  if (complimentary) {
    // El client ja el demanava el formulari; amb bo el valor s'ignorava perquè
    // sortia del bo mateix. Sense bo és l'única manera de saber de qui és.
    if (!clientId) return { ok: false, error: "Tria un client." };
    if (!(SERVICE_TYPES as string[]).includes(serviceType))
      return { ok: false, error: "Tria un tipus de servei." };
    return {
      ok: true,
      repeatWeeks,
      input: {
        bonoId: null,
        clientId,
        serviceType: serviceType as ServiceType,
        trainerId,
        scheduledAt,
      },
    };
  }

  if (!bonoId) return { ok: false, error: "Tria un bo." };
  return { ok: true, repeatWeeks, input: { bonoId, trainerId, scheduledAt } };
}
