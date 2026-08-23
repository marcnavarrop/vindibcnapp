"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import {
  resolveSeries,
  commitSeries,
  cancelSeries,
  type SeriesRequest,
} from "@/lib/data/booking-series";
import type { ResolvedOccurrence } from "@/lib/booking-series-core";
import type { BookingFrequency, ServiceType } from "@/types/database";

/**
 * Les tres accions de l'assistent de reserva en bucle.
 *
 * `calculateSeriesAction` NO escriu res: només diu com quedaria. L'escriptura
 * és tota a `confirmSeriesAction`, d'una tacada. Separar-ho vol dir que el
 * client pot recalcular tants cops com vulgui —canviar la freqüència, acceptar
 * alternatives— sense deixar mitja sèrie feta a la base si al final se'n va.
 */

export type SeriesFormInput = {
  firstAt: string;
  trainerId: string;
  serviceType: ServiceType;
  frequency: BookingFrequency;
  endDate: string | null;
  occurrenceCount: number | null;
  bookOnlyAvailable: boolean;
  allowAlternatives: boolean;
  allowWaitlist: boolean;
};

export type CalculateState = {
  error?: string;
  occurrences?: ResolvedOccurrence[];
  bonoRemaining?: number;
  /** Ocurrències que no s'han pogut generar perquè el bo s'havia acabat. */
  skippedForBono?: number;
};

function toRequest(profileId: string, input: SeriesFormInput): SeriesRequest {
  return {
    profileId,
    firstAt: input.firstAt,
    trainerId: input.trainerId,
    serviceType: input.serviceType,
    frequency: input.frequency,
    endDate: input.endDate,
    occurrenceCount: input.occurrenceCount,
    bookOnlyAvailable: input.bookOnlyAvailable,
    allowAlternatives: input.allowAlternatives,
    allowWaitlist: input.allowWaitlist,
  };
}

export async function calculateSeriesAction(
  input: SeriesFormInput,
): Promise<CalculateState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  // Una sèrie sense final seria infinita: es demana com a mínim un dels dos
  // límits, igual que ho exigeix la base de dades.
  if (!input.endDate && !input.occurrenceCount)
    return { error: "Digues fins quan es repeteix o quantes sessions vols." };

  const plan = await resolveSeries(toRequest(viewer.id, input));
  if (plan.error) return { error: plan.error };
  return {
    occurrences: plan.occurrences,
    bonoRemaining: plan.bonoRemaining,
    skippedForBono: plan.skippedForBono,
  };
}

export type ConfirmState = {
  error?: string;
  ok?: boolean;
  created?: number;
  /** Reserves que ja existien i s'han incorporat a la sèrie. */
  adopted?: number;
  waitlisted?: number;
  failed?: number;
};

export async function confirmSeriesAction(
  input: SeriesFormInput,
  decided: ResolvedOccurrence[],
): Promise<ConfirmState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };
  if (decided.length === 0) return { error: "No hi ha res a confirmar." };

  try {
    const res = await commitSeries(toRequest(viewer.id, input), decided);
    revalidatePath("/client/reservas");
    revalidatePath("/client");
    return {
      ok: true,
      created: res.created,
      adopted: res.adopted,
      waitlisted: res.waitlisted,
      failed: res.failed,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut crear la sèrie.",
    };
  }
}

export type CancelSeriesState = {
  error?: string;
  ok?: boolean;
  cancelled?: number;
  kept?: number;
};

/** Cancel·la totes les reserves futures d'una sèrie. */
export async function cancelSeriesAction(
  _prev: CancelSeriesState,
  formData: FormData,
): Promise<CancelSeriesState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  const seriesId = String(formData.get("seriesId") ?? "");
  if (!seriesId) return { error: "Sèrie no indicada." };

  // La sèrie ha de ser d'aquest client: `cancelSeries` itera amb la
  // cancel·lació individual, que ja ho comprova reserva per reserva, però
  // val més no ni començar amb una sèrie d'algú altre. El client també fa
  // d'acotació en marcar la sèrie com a cancel·lada.
  const client = await getClientByProfile(viewer.id);
  if (!client) return { error: "No tens fitxa de client." };

  try {
    const res = await cancelSeries(viewer.id, seriesId, client.id);
    revalidatePath("/client/reservas");
    revalidatePath("/client");
    return { ok: true, cancelled: res.cancelled, kept: res.kept };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut cancel·lar la sèrie.",
    };
  }
}
