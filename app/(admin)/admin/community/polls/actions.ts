"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createPoll, closePoll, deletePoll } from "@/lib/data/polls";

export async function createPollAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;

  const question = String(formData.get("question") ?? "").trim();
  const allowMultiple = formData.get("allow_multiple") === "true";
  const closesAt = String(formData.get("closes_at") ?? "").trim() || null;

  // Options are sent as option_0, option_1, ...
  const options: string[] = [];
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("option_")) {
      const label = String(val).trim();
      if (label) options.push(label);
    }
  }

  if (!question || options.length < 2) return;

  await createPoll({ question, allowMultiple, closesAt, options }, viewer.id);
  revalidatePath("/admin/community");
  redirect("/admin/community?tab=polls");
}

export async function closePollAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await closePoll(id);
  revalidatePath("/admin/community");
}

export async function deletePollAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deletePoll(id);
  revalidatePath("/admin/community");
}
