"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { submitPollResponse, PollError } from "@/lib/data/polls";
import type { PollErrorCode } from "@/lib/data/polls";

export type { PollErrorCode };

/** Codi, no frase: la comunitat es llegeix en tres idiomes. */
export type PollFormState = { errorCode?: PollErrorCode };

/**
 * Vot a una enquesta.
 *
 * Abans això s'empassava els errors en silenci i confiava que la pàgina es
 * refresqués amb l'estat bo. Quan funcionava no es notava; quan fallava,
 * tampoc —i qui votava es quedava sense saber si el vot havia entrat. Ara el
 * motiu torna com a codi i la targeta el diu.
 */
export async function submitPollResponseAction(
  _prev: PollFormState,
  formData: FormData,
): Promise<PollFormState> {
  const viewer = await getViewer();
  if (!viewer) return { errorCode: "failed" };

  const client = await getClientByProfile(viewer.id);
  if (!client) return { errorCode: "failed" };

  const pollId = String(formData.get("poll_id") ?? "");
  const optionIds = formData.getAll("option_id").map(String).filter(Boolean);

  if (!pollId) return { errorCode: "failed" };
  if (optionIds.length === 0) return { errorCode: "noOption" };

  try {
    await submitPollResponse(pollId, optionIds, client.id);
  } catch (e) {
    return { errorCode: e instanceof PollError ? e.code : "failed" };
  }

  revalidatePath("/client/comunitat");
  revalidatePath("/client");
  return {};
}
