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
import { getViewer, requireRole } from "@/lib/auth";
import {
  actionError,
  type ReservationActionState,
} from "@/lib/reservation-action-state";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import { bookFromSlot } from "@/lib/data/slot-create";

/**
 * Crea una reserva des de l'àrea del professional. Qui pot reservar què ho
 * decideix `assertMayBookFor` → `staffBookingScope` (0107): els seus clients,
 * qualsevol grup, i la seva especialitat a la seva agenda.
 */
export async function createTrainerReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireRole("trainer"))) return { error: "No autoritzat." };
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
  if (!(await requireRole("trainer"))) return { error: "No autoritzat." };
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

/** Marca una reserva com a feta: els seus clients o la seva agenda (0107). */
export async function completeTrainerReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  if (!(await requireRole("trainer"))) return { error: "No autoritzat." };
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

/** Reprograma una reserva: la mateixa regla que en crear (0107). */
export async function rescheduleTrainerReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  if (!(await requireRole("trainer"))) return { error: "No autoritzat." };
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

/**
 * Crea una reserva a un forat de la SEVA agenda, o apunta un client a un grup
 * amb places: seu o, des de la 0107, d'un company (decisió (a) d'en Marc:
 * qualsevol grup del centre). El que fa de debò és `bookFromSlot`, compartit
 * amb l'admin.
 *
 * L'agenda d'un altre només s'accepta per a GRUP. La resta de la regla (de qui
 * és el client, cortesia, especialitat) la torna a mirar `createReservation`.
 */
export async function createFromSlotAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };
  const target = String(formData.get("trainerId") ?? "") || viewer.id;
  if (target !== viewer.id && formData.get("serviceType") !== "grupo_reducido")
    return { error: "A l'agenda d'un company només hi pots apuntar algú a un grup." };
  const result = await bookFromSlot(formData, target);
  if (!result.ok) return result;
  revalidatePath("/trainer/reservas");
  revalidatePath("/trainer/bonos");
  return { ok: true };
}
