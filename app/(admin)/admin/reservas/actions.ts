"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  type ReservationActionState,
} from "@/lib/reservation-action-state";
import { redirect } from "next/navigation";
import {
  createReservation,
  cancelReservation,
  completeReservation,
  rescheduleReservation,
} from "@/lib/data/reservations";
import { parseReservationForm } from "@/lib/data/reservation-input";
import { datetimeLocalToInstant } from "@/lib/center-time";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import { getViewer } from "@/lib/auth";
import { bookFromSlot } from "@/lib/data/slot-create";

export async function createReservationAction(
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
    return { error: e instanceof Error ? e.message : "Error en crear la reserva." };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/admin/bonos");
  redirect("/admin/reservas");
}

/**
 * Cancel·la una reserva. Torna l'estat en comptes de llançar: la pantalla
 * espera la resposta per dir si s'ha fet (vegeu `lib/reservation-action-state`).
 */
export async function cancelReservationAction(
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
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/bonos");
  return { ok: true };
}

export async function completeReservationAction(
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
  revalidatePath("/admin/reservas");
  return { ok: true };
}

export async function rescheduleReservationAction(
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
  revalidatePath("/admin/reservas");
  return { ok: true };
}

/**
 * Crea una reserva al forat que s'ha tocat a l'agenda de l'admin, o apunta un
 * client a un grup amb places. El professional és el de la columna (camp
 * `trainerId`) i el client, qualsevol del centre. La resta és la mateixa peça
 * que fa servir el professional (`bookFromSlot`).
 */
export async function createFromSlotAdminAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };
  const trainerId = String(formData.get("trainerId") ?? "");
  if (!trainerId) return { error: "Falta el professional." };
  const result = await bookFromSlot(formData, trainerId);
  if (!result.ok) return result;
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/bonos");
  return { ok: true };
}
