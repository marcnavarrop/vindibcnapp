"use server";

import { getViewer } from "@/lib/auth";
import { listClientsPage, type ClientsPageItem } from "@/lib/data/clients";

export type ClientListFilters = {
  q: string;
  /** Admin: filtre per professional (?trainer=). */
  trainerId?: string | null;
  /** Professional: «Els meus» o «Tots». */
  scope?: "mine" | "all";
  /** Professional, a «Tots»: la cartera d'un company (?professional=). */
  professionalId?: string | null;
};

export type LoadMoreClientsResult =
  | { ok: true; items: ClientsPageItem[]; nextCursor: string | null }
  | { ok: false; error: string };

/**
 * Les pàgines següents de la llista de clients («Carregar més»).
 *
 * Qui pot sortir-hi ho decideix el rol de qui mira, com a
 * `searchClientsAction`, i no el que arribi del navegador: l'admin, qualsevol
 * client (amb el seu filtre de professional); el professional, tots per
 * consultar-los o només els seus amb «Els meus», sempre amb el SEU id i mai
 * un altre.
 */
export async function loadMoreClientsAction(
  filters: ClientListFilters,
  cursor: string,
): Promise<LoadMoreClientsResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { ok: false, error: "No autoritzat." };

  const safe = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v) ? v : null;
  // El professional pot veure tots els clients (per coordinar-se), així que a
  // «Tots» pot filtrar per la cartera d'un company. A «Els meus», sempre el seu.
  const trainerId =
    viewer.role === "admin"
      ? safe(filters?.trainerId)
      : filters?.scope === "all"
        ? safe(filters?.professionalId)
        : viewer.id;

  try {
    const page = await listClientsPage({
      q: typeof filters?.q === "string" ? filters.q : "",
      trainerId,
      cursor,
    });
    return { ok: true, items: page.items, nextCursor: page.nextCursor };
  } catch (e) {
    console.error("[clients] carregar més:", e);
    return { ok: false, error: "No s'han pogut carregar més clients. Torna-ho a provar." };
  }
}
