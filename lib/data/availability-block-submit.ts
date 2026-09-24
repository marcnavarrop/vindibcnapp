import "server-only";
import { centerLocalToInstant } from "@/lib/center-time";
import { getCenterSettings } from "@/lib/data/center-settings";
import { createAvailabilityBlock } from "@/lib/data/availability-blocks";
import {
  previewOrphans,
  orphanCount,
  cancelOrphans,
  selectionFromForm,
  mayManage,
  actingTrainerId,
  outcomeSummary,
  type Actor,
  type Orphans,
} from "@/lib/data/availability-orphans";

const pad = (n: number) => String(n).padStart(2, "0");

export type BlockFormState = {
  error?: string;
  ok?: boolean;
  /** Què s'ha cancel·lat en confirmar. */
  notice?: string;
  /** El bloqueig s'ha creat, però alguna cancel·lació no ha anat bé. */
  warning?: string;
  /** El bloqueig deixaria compromisos orfes: no s'ha creat res encara. */
  pending?: {
    startAt: string;
    endAt: string;
    reason: string | null;
    orphans: Orphans;
  };
};

/** Llegeix el rang del formulari, en mode "dia complet" o amb hores exactes. */
function parseRange(
  fd: FormData,
  openingHour: number,
  closingHour: number,
): { startAt: string; endAt: string } {
  const confirmStart = String(fd.get("confirmStartAt") ?? "");
  const confirmEnd = String(fd.get("confirmEndAt") ?? "");
  if (confirmStart && confirmEnd)
    return { startAt: confirmStart, endAt: confirmEnd };

  const allDay = fd.get("allDay") === "on";

  if (allDay) {
    const from = String(fd.get("startDay") ?? "").trim();
    const to = String(fd.get("endDay") ?? "").trim() || from;
    if (!from) throw new Error("Indica el dia d'inici.");
    return {
      startAt: centerLocalToInstant(from, pad(openingHour) + ":00").toISOString(),
      endAt: centerLocalToInstant(to, pad(closingHour) + ":00").toISOString(),
    };
  }

  const start = String(fd.get("startAt") ?? "").trim();
  const end = String(fd.get("endAt") ?? "").trim();
  if (!start || !end) throw new Error("Indica l'inici i el final del bloqueig.");
  const [sDay, sTime] = start.split("T");
  const [eDay, eTime] = end.split("T");
  return {
    startAt: centerLocalToInstant(sDay, sTime).toISOString(),
    endAt: centerLocalToInstant(eDay, eTime).toISOString(),
  };
}

/**
 * Alta d'un bloqueig en dues passades:
 *  1a — si el bloqueig deixa compromisos orfes (reserves, proves o esperes que
 *       ja no tindrien on caure), torna `pending` amb la llista i NO crea res.
 *  2a — amb `confirmOrphans`, crea el bloqueig i cancel·la NOMÉS el que s'ha
 *       deixat marcat i segueix sent orfe (`cancelOrphans`).
 *
 * Abans la llista només tenia les reserves que COMENÇAVEN dins del bloqueig
 * (una sessió de 12:00 a 13:00 amb un bloqueig des de les 12:30 no hi sortia),
 * ignorava les proves i la llista d'espera, i cancel·lava amb
 * `cancelReservation`, que promocionava algú de la cua a la franja que
 * s'acabava de bloquejar. Ara és el mateix detector que fan servir les franges.
 */
export async function submitAvailabilityBlock(
  trainerId: string,
  createdBy: string | null,
  fd: FormData,
  actor: Actor,
): Promise<BlockFormState> {
  if (!mayManage(actor, trainerId)) return { error: "No autoritzat." };
  const { openingHour, closingHour } = await getCenterSettings();

  let range: { startAt: string; endAt: string };
  try {
    range = parseRange(fd, openingHour, closingHour);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dades no vàlides." };
  }

  if (new Date(range.endAt) <= new Date(range.startAt))
    return { error: "La data de fi ha de ser posterior a la d'inici." };

  const reason = String(fd.get("reason") ?? "").trim() || null;
  const isConfirmation = fd.get("confirmOrphans") === "1";

  if (!isConfirmation) {
    const orphans = await previewOrphans(trainerId, (now) => ({
      rules: now.rules,
      blocks: [...now.blocks, range],
    }));
    if (orphanCount(orphans) > 0)
      return { pending: { ...range, reason, orphans } };
  }

  try {
    await createAvailabilityBlock({
      trainerId,
      startAt: range.startAt,
      endAt: range.endAt,
      reason,
      createdBy,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut crear el bloqueig.",
    };
  }

  if (!isConfirmation) return { ok: true };
  const { notice, warning } = outcomeSummary(
    await cancelOrphans(trainerId, actingTrainerId(actor), selectionFromForm(fd)),
  );
  return {
    ok: true,
    ...(notice ? { notice } : {}),
    ...(warning ? { warning: `El bloqueig s'ha creat. ${warning}` } : {}),
  };
}
