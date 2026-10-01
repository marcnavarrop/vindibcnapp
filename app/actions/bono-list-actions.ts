"use server";

import { getViewer } from "@/lib/auth";
import { BONO_FILTERS, listBonosPage, type BonoFilter, type BonoListItem } from "@/lib/data/bonos";
import { SERVICE_TYPES } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export type BonoListFilters = {
  filter?: BonoFilter;
  /** Professional: nom del client. */
  q?: string;
  /** Professional: servei. */
  serviceType?: ServiceType | null;
  /** Professional: «Els meus» o «Tots». */
  scope?: "mine" | "all";
};

export type LoadMoreBonosResult =
  | { ok: true; items: BonoListItem[]; nextCursor: string | null }
  | { ok: false; error: string };

/**
 * Les pàgines següents de les llistes de bons («Carregar més»).
 *
 * L'abast el decideix el rol de qui mira, no el navegador: l'admin veu tot el
 * centre; el professional, tot el centre a «Tots» (coordinació, 0085) o només
 * els bons dels SEUS clients a «Els meus», sempre amb el seu id.
 */
export async function loadMoreBonosAction(
  filters: BonoListFilters,
  cursor: string,
): Promise<LoadMoreBonosResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { ok: false, error: "No autoritzat." };

  const filter = BONO_FILTERS.includes(filters?.filter as BonoFilter)
    ? (filters.filter as BonoFilter)
    : "all";
  const serviceType = SERVICE_TYPES.includes(filters?.serviceType as ServiceType)
    ? (filters.serviceType as ServiceType)
    : null;

  try {
    const page = await listBonosPage({
      filter,
      q: viewer.role === "trainer" && typeof filters?.q === "string" ? filters.q : "",
      serviceType: viewer.role === "trainer" ? serviceType : null,
      assignedTrainerId: viewer.role === "trainer" && filters?.scope !== "all" ? viewer.id : null,
      cursor,
    });
    return { ok: true, items: page.items, nextCursor: page.nextCursor };
  } catch (e) {
    console.error("[bons] carregar més:", e);
    return { ok: false, error: "No s'han pogut carregar més bons. Torna-ho a provar." };
  }
}
