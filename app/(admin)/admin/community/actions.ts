"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementInput,
} from "@/lib/data/announcements";
import { notifyCommunity } from "@/lib/notifications/community";
import { getViewer } from "@/lib/auth";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

function parse(formData: FormData): AnnouncementInput {
  return {
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
  };
}

function validate(input: AnnouncementInput): string | null {
  if (!input.title) return "El títol és obligatori.";
  if (!input.body) return "El contingut és obligatori.";
  return null;
}

export async function createAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };

  const viewer = await getViewer();
  if (!viewer) return { error: "Sessió no vàlida." };

  let announcementId: string;
  try {
    announcementId = await createAnnouncement(input, viewer.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en publicar." };
  }
  // Avisa qui tingui la comunitat activada (best-effort, no bloqueja).
  await notifyCommunity({ announcementId, title: input.title, body: input.body });
  revalidatePath("/admin/community");
  redirect("/admin/community");
}

export async function updateAnnouncementAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };

  try {
    await updateAnnouncement(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }
  revalidatePath("/admin/community");
  redirect("/admin/community");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAnnouncement(id);
  revalidatePath("/admin/community");
}
