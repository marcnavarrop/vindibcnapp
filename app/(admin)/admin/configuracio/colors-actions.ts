"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  isHexColor,
  setProfessionalColor,
  setServiceTypeColor,
} from "@/lib/data/colors";
import { SERVICE_TYPES } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export type ColorsState = { error?: string; ok?: boolean };

/**
 * Desa tota la paleta d'una tirada.
 *
 * El formulari envia un camp per professional (`pro:<id>`) i un per servei
 * (`svc:<tipus>`). Es valida TOT abans d'escriure res: si un color ve
 * malament, no es desa cap, i així la paleta no queda a mitges.
 */
export async function updateColorsAction(
  _prev: ColorsState,
  fd: FormData,
): Promise<ColorsState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const pros: [string, string][] = [];
  const services: [ServiceType, string][] = [];

  for (const [key, raw] of fd.entries()) {
    if (typeof raw !== "string") continue;
    const value = raw.trim().toLowerCase();

    if (key.startsWith("pro:")) {
      if (!isHexColor(value))
        return { error: `Color no vàlid: "${raw}". Ha de ser un hex #rrggbb.` };
      pros.push([key.slice(4), value]);
    } else if (key.startsWith("svc:")) {
      const type = key.slice(4) as ServiceType;
      if (!SERVICE_TYPES.includes(type))
        return { error: "Tipus de servei desconegut." };
      if (!isHexColor(value))
        return { error: `Color no vàlid: "${raw}". Ha de ser un hex #rrggbb.` };
      services.push([type, value]);
    }
  }

  try {
    for (const [type, color] of services) await setServiceTypeColor(type, color);
    for (const [id, color] of pros) await setProfessionalColor(id, color);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'han pogut desar els colors.",
    };
  }

  // Els colors es pinten a tots els calendaris i llegendes: cal refrescar-los
  // tots, no només la pantalla de configuració.
  for (const path of [
    "/admin/configuracio",
    "/admin/reservas",
    "/admin/entrenadors",
    "/trainer/reservas",
    "/client/reservas",
    "/client/bonos/comprar",
  ])
    revalidatePath(path);

  return { ok: true };
}
