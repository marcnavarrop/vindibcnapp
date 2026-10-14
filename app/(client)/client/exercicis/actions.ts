"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getClientRefByProfile } from "@/lib/data/clients";
import {
  AlreadyDoneError,
  markWorkoutDayDone,
  unmarkWorkoutDayDone,
} from "@/lib/data/client-exercises";

/**
 * «Dia fet» (0112): el client marca que ha fet un dia de la seva pauta, amb
 * data d'avui, i el pot desmarcar el mateix dia. Va amb la seva sessió: la RLS
 * només li deixa marcar el SEU client, amb data d'AVUI i signant amb el seu nom.
 */

export type DayDoneResult = { ok: true } | { ok: false; error: string };

export async function markDayDoneAction(dayId: string): Promise<DayDoneResult> {
  const viewer = await requireRole("client");
  const t = await getTranslations("workouts.plan");
  if (!viewer) return { ok: false, error: t("errorGeneric") };
  const client = await getClientRefByProfile(viewer.id);
  if (!client) return { ok: false, error: t("errorGeneric") };
  try {
    await markWorkoutDayDone(client.id, dayId, viewer.id);
  } catch (e) {
    // Ja estava marcat (una altra pestanya, un doble toc): és el que volia.
    if (!(e instanceof AlreadyDoneError)) {
      console.error("[dia fet] no s'ha pogut marcar:", e);
      return { ok: false, error: t("errorMark") };
    }
  }
  revalidatePath("/client/exercicis");
  return { ok: true };
}

export async function unmarkDayDoneAction(dayId: string): Promise<DayDoneResult> {
  const viewer = await requireRole("client");
  const t = await getTranslations("workouts.plan");
  if (!viewer) return { ok: false, error: t("errorGeneric") };
  const client = await getClientRefByProfile(viewer.id);
  if (!client) return { ok: false, error: t("errorGeneric") };
  try {
    await unmarkWorkoutDayDone(client.id, dayId);
  } catch (e) {
    console.error("[dia fet] no s'ha pogut desmarcar:", e);
    return { ok: false, error: t("errorUnmark") };
  }
  revalidatePath("/client/exercicis");
  return { ok: true };
}
