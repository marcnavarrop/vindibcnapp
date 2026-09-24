"use server";

import { getViewer } from "@/lib/auth";
import {
  getReservationDetail,
  type ReservationDetail,
} from "@/lib/data/reservation-detail";

export type ReservationDetailResult =
  | { ok: true; detail: ReservationDetail }
  | { ok: false; error: string };

/**
 * El que la fitxa d'una reserva demana en obrir-se (vegeu
 * `lib/data/reservation-detail.ts`). Només per a l'equip: el client té la seva
 * pròpia pantalla. Qui veu què ho decideix la RLS amb la sessió de qui crida;
 * aquesta comprovació només evita que un client la faci servir per preguntar.
 */
export async function getReservationDetailAction(
  id: string,
): Promise<ReservationDetailResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { ok: false, error: "No tens permís per veure aquesta reserva." };
  try {
    const detail = await getReservationDetail(id);
    if (!detail) return { ok: false, error: "Aquesta reserva ja no existeix." };
    return { ok: true, detail };
  } catch {
    return { ok: false, error: "No s'han pogut carregar les dades de la reserva." };
  }
}
