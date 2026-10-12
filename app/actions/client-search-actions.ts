"use server";

import { getViewer } from "@/lib/auth";
import {
  searchBookableClients,
  type BookableClient,
} from "@/lib/data/slot-booking";

export type ClientSearchResult =
  | { ok: true; clients: BookableClient[] }
  | { ok: false; error: string };

/**
 * El buscador de clients per reservar, per a l'admin i per al professional.
 *
 * Qui pot sortir-hi NO ho diu la pantalla: ho diu el rol de qui mira. L'admin
 * troba qualsevol client del centre. El professional també (0107), però els
 * clients que no són seus surten `restricted`, amb només els bons de grup o de
 * la seva especialitat, i els demo només si ell també ho és.
 */
export async function searchClientsAction(query: string): Promise<ClientSearchResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { ok: false, error: "No autoritzat." };
  try {
    const clients = await searchBookableClients(
      typeof query === "string" ? query : "",
      viewer.role === "trainer" ? { id: viewer.id, specialty: viewer.specialty } : null,
    );
    return { ok: true, clients };
  } catch {
    return { ok: false, error: "No s'han pogut buscar els clients." };
  }
}
