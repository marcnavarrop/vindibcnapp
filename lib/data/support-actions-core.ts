import "server-only";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createSupportTicket,
  setSupportTicketStatus,
  validateTicket,
} from "@/lib/data/support";
import { notifySupportTicket } from "@/lib/notifications/support";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "@/lib/labels";
import type { SupportCategory, SupportStatus } from "@/types/database";

export type SupportFormState = { error?: string; ok?: boolean };

/**
 * Nucli compartit per les dues àrees.
 *
 * Admin i professional obren tiquets exactament igual; l'únic que canvia és
 * quina ruta cal refrescar i què diu el correu sobre d'on ve. Tenir-ho aquí
 * evita dues còpies que s'aniguin separant.
 */
export async function createTicketCore(
  fd: FormData,
  opts: { area: "Administració" | "Professional"; revalidate: string },
): Promise<SupportFormState> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { error: "No autoritzat." };

  const category = String(fd.get("category") ?? "") as SupportCategory;
  if (!SUPPORT_CATEGORIES.includes(category))
    return { error: "Tria una categoria." };

  const checked = validateTicket({
    title: String(fd.get("title") ?? ""),
    description: String(fd.get("description") ?? ""),
    category,
  });
  if (!checked.ok) return { error: checked.error };

  let ticket;
  try {
    ticket = await createSupportTicket(viewer.id, checked.value);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut crear el tiquet.",
    };
  }

  // Best-effort: el tiquet ja està desat. Si el correu falla, notify() ho
  // registra al log i no torna cap error — el que no pot passar és que qui
  // reporta una incidència la perdi perquè Resend estigués caigut.
  await notifySupportTicket(ticket, opts.area);

  revalidatePath(opts.revalidate);
  return { ok: true };
}

/** Canvi d'estat. Només l'admin; la RLS ho torna a comprovar. */
export async function setStatusCore(
  fd: FormData,
  revalidate: string,
): Promise<SupportFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "") as SupportStatus;
  if (!id) return { error: "Tiquet no indicat." };
  if (!SUPPORT_STATUSES.includes(status)) return { error: "Estat no vàlid." };

  try {
    await setSupportTicketStatus(id, status);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut canviar l'estat.",
    };
  }

  revalidatePath(revalidate);
  return { ok: true };
}
