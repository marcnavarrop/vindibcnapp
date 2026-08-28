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

export type WaitlistState = { error?: string; ok?: boolean };

export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  const trainerId = String(formData.get("trainerId") ?? "");
  const serviceType = String(formData.get("serviceType") ?? "") as ServiceType;
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  if (!trainerId || !scheduledAt) return { error: "Sessió no indicada." };

  try {
    await joinWaitlist({
      profileId: viewer.id,
      trainerId,
      serviceType,
      scheduledAt,
    });
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "No s'ha pogut apuntar a la llista d'espera.",
    };
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
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { error: "Espera no indicada." };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { error: "No tens fitxa de client." };

  try {
    await cancelWaitlistEntry(client.id, entryId);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut fer la baixa.",
    };
  }

  revalidatePath("/client/reservas");
  revalidatePath("/client");
  return { ok: true };
}
