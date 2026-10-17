"use server";

import { redirect } from "next/navigation";
import { verifyUnsubscribe } from "@/lib/unsubscribe";
import { unsubscribeCommunity } from "@/lib/data/community-notice";

/**
 * «Sí, no les vull rebre», des de l'enllaç del correu (0124). Sense sessió: la
 * barrera és la signatura de l'enllaç, que es torna a comprovar aquí.
 */
export async function unsubscribeCommunityAction(fd: FormData): Promise<void> {
  const p = String(fd.get("p") ?? "");
  const t = String(fd.get("t") ?? "");
  if (!verifyUnsubscribe(p, t)) redirect("/baixa/comunitat");
  let state = "fet";
  try {
    const r = await unsubscribeCommunity(p);
    if (!r) state = "error";
  } catch {
    state = "error";
  }
  redirect(`/baixa/comunitat?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}&estat=${state}`);
}
