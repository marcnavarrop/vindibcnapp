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
import { acceptTrial, rejectTrial } from "@/lib/data/trial-bookings";
import { datetimeLocalToInstant } from "@/lib/center-time";
import { getViewer } from "@/lib/auth";
import {
  actionError,
  type ReservationActionState,
} from "@/lib/reservation-action-state";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import {
  listBookableClients,
  pickUsableBono,
  type BookableClient,
} from "@/lib/data/slot-booking";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

/**
 * Crea una reserva desde el área de entrenador/a. La RLS garantiza que solo
 * puede hacerlo para sus clientes asignados (reservations_trainer_write).
 */
export async function createTrainerReservationAction(
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
    return {
      error: e instanceof Error ? e.message : "Error en crear la reserva.",
    };
  }

  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
  redirect("/trainer/reservas");
}

/**
 * Cancel·la una reserva: les dels seus clients assignats i qualsevol de la seva
 * agenda (0091). Qui ho decideix és `cancel_reservation`, a la base. Torna
 * l'estat en comptes de llançar: la pantalla espera la resposta.
 */
export async function cancelTrainerReservationAction(
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
  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
  return { ok: true };
}

/** Marca una reserva com a feta (RLS: només dels seus clients assignats). */
export async function completeTrainerReservationAction(
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
  revalidatePath("/trainer/reservas");
  return { ok: true };
}

/** Reprograma una reserva propia (RLS: solo de sus clientes asignados). */
export async function rescheduleTrainerReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const id = String(formData.get("id") ?? "");
  // Dues maneres d'arribar: un inici triat de la llista (ISO, rejilla del
  // professional) o el camp de data i hora (en hora del centre).
  const iso = String(formData.get("scheduledAtIso") ?? "");
  const raw = String(formData.get("scheduledAt") ?? "");
  const date = iso ? new Date(iso) : datetimeLocalToInstant(raw);
  if (!id) return { error: "Falta la reserva." };
  if (!date || Number.isNaN(date.getTime())) return { error: "Tria una data i una hora." };
  try {
    await rescheduleReservation(id, date.toISOString());
  } catch (e) {
    return actionError(e, "No s'ha pogut reprogramar la reserva.");
  }
  revalidatePath("/trainer/reservas");
  return { ok: true };
}

/** Accepta una sessió de prova pròpia (queda confirmada). */
export async function acceptTrialTrainerAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;
  const id = String(formData.get("id") ?? "");
  if (id) await acceptTrial(id, viewer.id);
  revalidatePath("/trainer/reservas");
}

/** Rebutja una sessió de prova pròpia (allibera el forat). */
export async function rejectTrialTrainerAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;
  const id = String(formData.get("id") ?? "");
  if (id) await rejectTrial(id, viewer.id);
  revalidatePath("/trainer/reservas");
}

export type BookableClientsResult =
  | { ok: true; clients: BookableClient[] }
  | { ok: false; error: string };

/**
 * Els clients per als quals pot reservar qui mira (els seus assignats), amb
 * els bons que poden gastar. Per a la fulla de crear des d'un forat.
 */
export async function getBookableClientsAction(): Promise<BookableClientsResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer")
    return { ok: false, error: "Només un professional pot reservar des de la seva agenda." };
  try {
    return { ok: true, clients: await listBookableClients(viewer.id) };
  } catch {
    return { ok: false, error: "No s'han pogut carregar els teus clients." };
  }
}

/**
 * Crea una reserva a un forat de la SEVA agenda, o apunta un client a un grup
 * seu amb places. El bo no el tria la pantalla: és el més antic utilitzable del
 * servei (`pickUsableBono`), el mateix que la fulla ensenyava. Sense bo, només
 * si es marca «cortesia».
 *
 * Tota la resta —permís, disponibilitat, bloquejos, ocupació, aforament i pany—
 * ho fa `createReservation`, com des del formulari. Si mentrestant algú ha
 * agafat el forat, l'error torna aquí i la fulla el pinta.
 */
export async function createFromSlotAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
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
        trainerId: viewer.id,
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
        trainerId: viewer.id,
        scheduledAt: at.toISOString(),
        bonoId: bono.id,
      });
    }
  } catch (e) {
    return actionError(e, "No s'ha pogut crear la reserva.");
  }
  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
  return { ok: true };
}
