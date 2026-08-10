"use server";

import { getViewer } from "@/lib/auth";
import { listMyRecentTickets } from "@/lib/data/support";
import {
  createTicketCore,
  type SupportFormState,
} from "@/lib/data/support-actions-core";
import type { SupportTicket } from "@/lib/data/support";

export type { SupportFormState };

/**
 * Alta des del widget flotant, compartida per les dues àrees.
 *
 * L'àrea i la ruta a refrescar es dedueixen del rol de la sessió, no d'una
 * prop que enviï el client: el navegador no ha de poder dir des d'on diu que
 * escriu.
 */
export async function createTicketFromWidgetAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { error: "No autoritzat." };

  return createTicketCore(fd, {
    area: viewer.role === "admin" ? "Administració" : "Professional",
    revalidate: viewer.role === "admin" ? "/admin/suport" : "/trainer/suport",
  });
}

/**
 * Els meus darrers tiquets, per al panell.
 *
 * Es demanen en obrir el widget i no al layout: si es carreguessin al marc
 * comú, cada pàgina d'admin i de professional pagaria una consulta més encara
 * que ningú toqui el botó.
 */
export async function listMyRecentTicketsAction(): Promise<SupportTicket[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  try {
    return await listMyRecentTickets(viewer.id, 5);
  } catch {
    return [];
  }
}
