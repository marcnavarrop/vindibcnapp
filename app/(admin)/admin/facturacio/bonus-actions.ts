"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { SERVICE_TYPES } from "@/lib/labels";
import {
  setWeight,
  saveTiers,
  setWorkerSettings,
  computeBonus,
  createPayout,
  findPayout,
  recentPeriods,
  getWorkerSettings,
} from "@/lib/data/bonus";
import { formatDate } from "@/lib/labels";
import type { ServiceType, BonusPayoutFrequency } from "@/types/database";

export type BonusFormState = { error?: string; ok?: boolean };

async function requireAdmin(): Promise<{ id: string } | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return null;
  return { id: viewer.id };
}

/** Desa el pes d'un servei (tancant la vigència de l'anterior). */
export async function updateWeightAction(
  _prev: BonusFormState,
  fd: FormData,
): Promise<BonusFormState> {
  if (!(await requireAdmin())) return { error: "No autoritzat." };

  const serviceType = String(fd.get("serviceType") ?? "") as ServiceType;
  const weight = parseFloat(String(fd.get("weight") ?? ""));

  if (!SERVICE_TYPES.includes(serviceType))
    return { error: "Tipus de servei invàlid." };
  if (!Number.isFinite(weight) || weight < 0)
    return { error: "El pes ha de ser un número positiu." };
  if (weight > 999) return { error: "El pes és massa alt." };

  try {
    await setWeight(serviceType, Math.round(weight * 1000) / 1000);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar el pes." };
  }

  revalidatePath("/admin/facturacio/bonus");
  return { ok: true };
}

/**
 * Desa el joc de trams sencer. Arriben com a arrays paral·lels (un valor per
 * fila del formulari); l'últim tram pot venir amb el màxim buit, que és el
 * tram obert.
 */
export async function saveTiersAction(
  _prev: BonusFormState,
  fd: FormData,
): Promise<BonusFormState> {
  if (!(await requireAdmin())) return { error: "No autoritzat." };

  const mins = fd.getAll("minUnits").map(String);
  const maxs = fd.getAll("maxUnits").map(String);
  const rates = fd.getAll("ratePerUnit").map(String);

  if (mins.length === 0) return { error: "Cal com a mínim un tram." };
  if (mins.length !== maxs.length || mins.length !== rates.length)
    return { error: "Dades dels trams incompletes." };

  const tiers = mins.map((m, i) => ({
    minUnits: parseFloat(m),
    maxUnits: maxs[i].trim() === "" ? null : parseFloat(maxs[i]),
    ratePerUnit: parseFloat(rates[i]),
  }));

  if (tiers.some((t) => Number.isNaN(t.minUnits) || Number.isNaN(t.ratePerUnit)))
    return { error: "Hi ha valors no numèrics als trams." };
  if (tiers.some((t) => t.maxUnits !== null && Number.isNaN(t.maxUnits)))
    return { error: "Hi ha màxims no numèrics." };

  try {
    await saveTiers(tiers);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar els trams." };
  }

  revalidatePath("/admin/facturacio/bonus");
  return { ok: true };
}

/** Activa/desactiva el bonus d'un professional i fixa la seva freqüència. */
export async function updateWorkerBonusAction(
  _prev: BonusFormState,
  fd: FormData,
): Promise<BonusFormState> {
  if (!(await requireAdmin())) return { error: "No autoritzat." };

  const trainerId = String(fd.get("trainerId") ?? "");
  const frequency = String(fd.get("payoutFrequency") ?? "") as BonusPayoutFrequency;
  const enabled = fd.get("enabled") === "true";

  if (!trainerId) return { error: "Falta el professional." };
  if (frequency !== "annual" && frequency !== "biennial")
    return { error: "Freqüència invàlida." };

  try {
    await setWorkerSettings(trainerId, enabled, frequency);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar la configuració." };
  }

  revalidatePath("/admin/facturacio/bonus");
  return { ok: true };
}

/**
 * Tanca un període d'un professional i en desa el resultat.
 *
 * El període arriba del selector, però no ens en fiem: ha de ser un dels que
 * corresponen a la freqüència d'aquest treballador. Els imports es recalculen
 * sempre al servidor.
 */
export async function generatePayoutAction(
  _prev: BonusFormState,
  fd: FormData,
): Promise<BonusFormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No autoritzat." };

  const trainerId = String(fd.get("trainerId") ?? "");
  const periodStart = String(fd.get("periodStart") ?? "");
  if (!trainerId) return { error: "Falta el professional." };

  try {
    const settings = await getWorkerSettings(trainerId);
    if (!settings || !settings.enabled)
      return { error: "Aquest professional no té el bonus actiu." };

    const period = recentPeriods(settings.payoutFrequency, 8).find(
      (p) => p.start === periodStart,
    );
    if (!period) return { error: "Període no vàlid per a aquest professional." };

    const existing = await findPayout(trainerId, period.start, period.end);
    if (existing)
      return {
        error: `Aquest període ja té un payout generat el ${formatDate(existing.generatedAt)}.`,
      };

    const progress = await computeBonus(trainerId, period, settings.payoutFrequency);
    if (progress.totalUnits <= 0)
      return { error: "No hi ha unitats acumulades en aquest període." };

    await createPayout(progress, admin.id);
  } catch (e) {
    // Cursa entre la comprovació i la inserció: qui guanya és l'índex UNIQUE.
    const msg = e instanceof Error ? e.message : "";
    if (msg === "DUPLICATE_PAYOUT" || msg.includes("bonus_payouts_unique_period"))
      return { error: "Aquest període ja té un payout generat." };
    return { error: msg || "Error en generar el bonus." };
  }

  revalidatePath("/admin/facturacio/bonus");
  return { ok: true };
}
