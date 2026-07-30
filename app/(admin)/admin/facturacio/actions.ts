"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { SERVICE_TYPES } from "@/lib/labels";
import {
  setRate,
  computeSettlement,
  createSettlement,
} from "@/lib/data/settlements";
import type { ServiceType } from "@/types/database";

export type RateFormState = { error?: string; ok?: boolean };
export type SettlementFormState = { error?: string; ok?: boolean; savedId?: string };

async function requireAdmin(): Promise<{ id: string } | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return null;
  return { id: viewer.id };
}

/** Desa la tarifa del centre per a un servei (tancant la vigent). */
export async function updateRateAction(
  _prev: RateFormState,
  fd: FormData,
): Promise<RateFormState> {
  if (!(await requireAdmin())) return { error: "No autoritzat." };

  const serviceType = String(fd.get("serviceType") ?? "") as ServiceType;
  const amount = parseFloat(String(fd.get("rateAmount") ?? ""));

  if (!SERVICE_TYPES.includes(serviceType))
    return { error: "Tipus de servei invàlid." };
  if (!Number.isFinite(amount) || amount < 0)
    return { error: "L'import ha de ser un número positiu." };
  if (amount > 100000) return { error: "L'import és massa alt." };

  try {
    await setRate(serviceType, Math.round(amount * 100) / 100);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar la tarifa." };
  }

  revalidatePath("/admin/facturacio/tarifes");
  return { ok: true };
}

/**
 * Desa una liquidació. Recalcula al servidor a partir del període rebut i no
 * es fia dels imports que arribin del formulari: el total que es desa és el
 * que surt de les dades, no el que hagi pogut manipular el client.
 */
export async function generateSettlementAction(
  _prev: SettlementFormState,
  fd: FormData,
): Promise<SettlementFormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No autoritzat." };

  const trainerId = String(fd.get("trainerId") ?? "");
  const periodStart = String(fd.get("periodStart") ?? "");
  const periodEnd = String(fd.get("periodEnd") ?? "");

  if (!trainerId) return { error: "Tria un professional." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))
    return { error: "Període invàlid." };
  if (periodEnd < periodStart)
    return { error: "La data final ha de ser posterior a la inicial." };

  try {
    const preview = await computeSettlement(trainerId, periodStart, periodEnd);
    if (preview.lines.length === 0)
      return { error: "No hi ha sessions valorables en aquest període." };
    const savedId = await createSettlement(preview, admin.id);
    revalidatePath("/admin/facturacio/liquidacions");
    return { ok: true, savedId };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en generar la liquidació.",
    };
  }
}
