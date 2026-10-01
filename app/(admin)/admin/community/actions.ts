"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementInput,
} from "@/lib/data/announcements";
import { deliverCommunity, queueCommunity } from "@/lib/notifications/community";
import { requireRole } from "@/lib/auth";
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

  // Només l'admin: publicar envia un correu a tota la comunitat.
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "No autoritzat." };

  let announcementId: string;
  try {
    announcementId = await createAnnouncement(input, viewer.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en publicar." };
  }
  // El correu: aquí només s'apunten els destinataris (el total es veu de
  // seguida a l'anunci); l'enviament va a `after()`, quan l'admin ja té la
  // resposta. Si no es poden ni apuntar, l'anunci queda publicat i la
  // pantalla ho diu.
  const post = { announcementId, title: input.title, body: input.body };
  let mailFailed = false;
  try {
    const queued = await queueCommunity(post);
    if (queued.length) after(() => deliverCommunity(post, queued));
  } catch (e) {
    console.error("[community] no s'ha pogut preparar el correu", e);
    mailFailed = true;
  }
  revalidatePath("/admin/community");
  redirect(mailFailed ? "/admin/community?correu=error" : "/admin/community");
}

export async function updateAnnouncementAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireRole("admin"))) return { error: "No autoritzat." };
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
  if (!(await requireRole("admin"))) return;
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAnnouncement(id);
  revalidatePath("/admin/community");
}
