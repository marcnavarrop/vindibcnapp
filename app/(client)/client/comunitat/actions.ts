"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { submitPollResponse } from "@/lib/data/polls";

export async function submitPollResponseAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;

  const client = await getClientByProfile(viewer.id);
  if (!client) return;

  const pollId = String(formData.get("poll_id") ?? "");
  const optionIds = formData.getAll("option_id").map(String).filter(Boolean);

  if (!pollId || optionIds.length === 0) return;

  try {
    await submitPollResponse(pollId, optionIds, client.id);
  } catch {
    // Silently ignore (already voted, expired, etc.) — the UI reflects state on refresh
  }

  revalidatePath("/client/comunitat");
}
