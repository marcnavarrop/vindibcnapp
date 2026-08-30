"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { joinWaitlist, cancelWaitlistEntry } from "@/lib/data/waitlist";
import type { ServiceType } from "@/types/database";

/**
 * Apuntar-se i desapuntar-se d'una franja plena, fora de qualsevol sèrie.
 *
 * Les accions són primes a propòsit: totes les regles —que el centre tingui la
 * cua oberta, que tinguis bo, que la franja estigui realment plena i que no
 * t'hi apuntis dues vegades— viuen a `joinWaitlist`, que és l'única porta.
 */

/**
 * Els errors viatgen com a CODI: aquesta acció corre al servidor i no sap en
 * quin idioma llegeix el client. El text el posa la pantalla.
 */
export type ReservaErrorCode =
  | "unauthorized" | "noTrainer" | "badService" | "noDate" | "noReservation" | "noSession" | "noEntry" | "noClient" | "noSeries" | "noLimit" | "nothingToConfirm" | "failed";

export type WaitlistState = { errorCode?: ReservaErrorCode; ok?: boolean };

export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const trainerId = String(formData.get("trainerId") ?? "");
  const serviceType = String(formData.get("serviceType") ?? "") as ServiceType;
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  if (!trainerId || !scheduledAt) return { errorCode: "noSession" };

  try {
    await joinWaitlist({
      profileId: viewer.id,
      trainerId,
      serviceType,
      scheduledAt,
    });
  } catch (e) {
    console.error("[llista d'espera]", e);
    return { errorCode: "failed" };
  }

  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}

/** Desapuntar-se. Va acotat al client: no es pot treure ningú altre de la cua. */
export async function leaveWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { errorCode: "noEntry" };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { errorCode: "noClient" };

  try {
    await cancelWaitlistEntry(client.id, entryId);
  } catch (e) {
    console.error("[llista d'espera]", e);
    return { errorCode: "failed" };
  }

  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}
