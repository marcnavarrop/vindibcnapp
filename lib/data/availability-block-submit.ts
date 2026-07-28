import "server-only";
import { CENTER_TZ } from "@/lib/config";
import { CENTER_OPEN_HOUR, CENTER_CLOSE_HOUR } from "@/lib/availability-slots";
import {
  createAvailabilityBlock,
  listReservationsInRange,
  type AffectedReservation,
} from "@/lib/data/availability-blocks";
import { cancelReservation } from "@/lib/data/reservations";

export type BlockFormState = {
  error?: string;
  ok?: boolean;
  pending?: {
    startAt: string;
    endAt: string;
    reason: string | null;
    affected: AffectedReservation[];
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Desfasament (ms) entre UTC i l'hora del centre per a un instant donat. */
function centerOffsetMs(at: Date): number {
  const asUTC = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  const asCenter = new Date(at.toLocaleString("en-US", { timeZone: CENTER_TZ }));
  return asCenter.getTime() - asUTC.getTime();
}

/**
 * Converteix una hora de rellotge del centre ("2026-08-01", 7) en l'instant
 * absolut correcte. El servidor corre en UTC, així que interpretar la cadena
 * directament desplaçaria el bloqueig una o dues hores segons l'horari d'estiu.
 */
function centerLocalToInstant(dateStr: string, hhmm: string): Date {
  const naive = Date.parse(`${dateStr}T${hhmm}:00Z`);
  if (Number.isNaN(naive)) throw new Error("Data no vàlida.");
  const offset = centerOffsetMs(new Date(naive));
  const first = new Date(naive - offset);
  // Segona passada: prop d'un canvi d'hora, l'offset del resultat pot diferir.
  const refined = centerOffsetMs(first);
  return refined === offset ? first : new Date(naive - refined);
}

/** Llegeix el rang del formulari, en mode "dia complet" o amb hores exactes. */
function parseRange(fd: FormData): { startAt: string; endAt: string } {
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
      startAt: centerLocalToInstant(from, pad(CENTER_OPEN_HOUR) + ":00").toISOString(),
      endAt: centerLocalToInstant(to, pad(CENTER_CLOSE_HOUR) + ":00").toISOString(),
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
 *  1a — si hi ha reserves 'booked' dins del rang, torna `pending` amb la llista
 *       i no crea res encara.
 *  2a — amb `confirmStartAt` present, crea el bloqueig i cancel·la NOMÉS les
 *       reserves marcades explícitament (cancelReservation ja retorna la sessió
 *       al bo i envia l'email de cancel·lació).
 */
export async function submitAvailabilityBlock(
  trainerId: string,
  createdBy: string | null,
  fd: FormData,
): Promise<BlockFormState> {
  let range: { startAt: string; endAt: string };
  try {
    range = parseRange(fd);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dades no vàlides." };
  }

  if (new Date(range.endAt) <= new Date(range.startAt))
    return { error: "La data de fi ha de ser posterior a la d'inici." };

  const reason = String(fd.get("reason") ?? "").trim() || null;
  const isConfirmation = !!String(fd.get("confirmStartAt") ?? "");

  if (!isConfirmation) {
    const affected = await listReservationsInRange(
      trainerId,
      range.startAt,
      range.endAt,
    );
    if (affected.length > 0)
      return { pending: { ...range, reason, affected } };
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

  // Només les marcades: mai es cancel·la res automàticament.
  const toCancel = fd
    .getAll("cancelIds")
    .map(String)
    .filter(Boolean);
  const valid = new Set(
    (
      await listReservationsInRange(trainerId, range.startAt, range.endAt)
    ).map((r) => r.id),
  );
  for (const id of toCancel) {
    if (!valid.has(id)) continue; // no cancel·lis res de fora del rang
    try {
      await cancelReservation(id);
    } catch {
      // best-effort: el bloqueig ja existeix i la resta s'ha de poder cancel·lar
    }
  }

  return { ok: true };
}
