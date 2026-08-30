"use server";

import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getCenterSettings } from "@/lib/data/center-settings";
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
  errorCode?: ReservaErrorCode;
  occurrences?: ResolvedOccurrence[];
  bonoRemaining?: number;
  /** Ocurrències que no s'han pogut generar perquè el bo s'havia acabat. */
  skippedForBono?: number;
};

async function toRequest(
  profileId: string,
  input: SeriesFormInput,
): Promise<SeriesRequest> {
  // Amb la cua tancada pel centre, la sèrie no en pot crear cap entrada per
  // molt que ho demani el formulari. Es talla aquí i no només a la pantalla:
  // amagar una casella no impedeix que algú enviï el camp a mà.
  const { waitlistEnabled } = await getCenterSettings();
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
    allowWaitlist: waitlistEnabled && input.allowWaitlist,
  };
}

export async function calculateSeriesAction(
  input: SeriesFormInput,
): Promise<CalculateState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  // Una sèrie sense final seria infinita: es demana com a mínim un dels dos
  // límits, igual que ho exigeix la base de dades.
  if (!input.endDate && !input.occurrenceCount)
    return { errorCode: "noLimit" };

  const plan = await resolveSeries(await toRequest(viewer.id, input));
  if (plan.error) {
    console.error("[sèries]", plan.error);
    return { errorCode: "failed" };
  }
  return {
    occurrences: plan.occurrences,
    bonoRemaining: plan.bonoRemaining,
    skippedForBono: plan.skippedForBono,
  };
}

export type ConfirmState = {
  errorCode?: ReservaErrorCode;
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
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };
  if (decided.length === 0) return { errorCode: "nothingToConfirm" };

  try {
    const res = await commitSeries(await toRequest(viewer.id, input), decided);
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
    console.error("[sèries]", e);
    return { errorCode: "failed" };
  }
}

export type CancelSeriesState = {
  errorCode?: ReservaErrorCode;
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
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const seriesId = String(formData.get("seriesId") ?? "");
  if (!seriesId) return { errorCode: "noSeries" };

  // La sèrie ha de ser d'aquest client: `cancelSeries` itera amb la
  // cancel·lació individual, que ja ho comprova reserva per reserva, però
  // val més no ni començar amb una sèrie d'algú altre. El client també fa
  // d'acotació en marcar la sèrie com a cancel·lada.
  const client = await getClientByProfile(viewer.id);
  if (!client) return { errorCode: "noClient" };

  try {
    const res = await cancelSeries(viewer.id, seriesId, client.id);
    revalidatePath("/client/reservas");
    revalidatePath("/client");
    return { ok: true, cancelled: res.cancelled, kept: res.kept };
  } catch (e) {
    console.error("[sèries]", e);
    return { errorCode: "failed" };
  }
}
