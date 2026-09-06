import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { centerDateStr, centerHour, centerLocalToInstant } from "@/lib/center-time";
import { nextOccurrence } from "@/lib/booking-series-core";
import {
  applyOccurrences,
  resolveSeries,
  type SeriesRequest,
} from "@/lib/data/booking-series";
import type { Subscription } from "@/lib/data/subscriptions";
import type { BookingFrequency, ServiceType } from "@/types/database";

/**
 * L'extensió automàtica d'una sèrie quan la subscripció es renova (0074).
 *
 * Fins ara una sèrie s'aturava quan el bo s'acabava i les ocurrències que no hi
 * cabien es comptaven a `skippedForBono`. Amb una subscripció, cada mes n'arriben
 * de noves, així que la sèrie pot continuar sola —si el client ho ha demanat.
 *
 * TRES DECISIONS QUE NO SÓN ÒBVIES
 *
 * 1. HORITZÓ RODANT, no un pla llarg desat. Es reserva només fins on arriba el
 *    bo del mes, i a la renovació següent es torna a allargar. L'alternativa
 *    —desar el pla sencer i anar-lo complint— demanaria una taula nova i, sobre
 *    tot, reservaria places d'un grup de quatre amb mesos d'antelació.
 *
 * 2. LES ALTERNATIVES NO S'ACCEPTEN SOLES. A l'assistent, una alternativa la
 *    tria el client mirant-la. Aquí no hi ha ningú: moure-li la sessió del
 *    dimarts a les 10 al dijous a les 18 perquè aquella setmana estava plena
 *    seria decidir per ell. Si la franja no hi és, l'ocurrència no es fa (o va a
 *    la llista d'espera, si la sèrie ja hi anava: apuntar-s'hi no canvia res del
 *    que el client va demanar).
 *
 * 3. ELS LÍMITS DE LA SÈRIE MANEN SEMPRE. `occurrence_count` i `end_date` són
 *    el que diu quan s'acaba, i la renovació no els pot passar per sobre: una
 *    sèrie de deu sessions en fa deu encara que la subscripció duri un any.
 */

export type SeriesToExtend = {
  id: string;
  clientId: string;
  profileId: string;
  serviceType: ServiceType;
  frequency: BookingFrequency;
  baseTrainerId: string | null;
  endDate: string | null;
  occurrenceCount: number | null;
  bookOnlyAvailable: boolean;
  allowWaitlist: boolean;
  firstAt: string | null;
  /** Ocurrències ja col·locades: reserves (de qualsevol estat) i esperes. */
  placed: number;
  /** L'última ocurrència col·locada, per saber on continua el patró. */
  lastAt: string | null;
};

export type ExtensionOutcome = {
  seriesId: string;
  created: number;
  waitlisted: number;
  failed: number;
  /** Per què no s'ha allargat, si no s'ha allargat. */
  skipped?: "limitReached" | "noPattern" | "noTrainer";
};

/**
 * Allarga les sèries d'una subscripció que acaba de rebre el bo d'un mes nou.
 *
 * La crida tant la renovació al centre com el webhook de Stripe, just després
 * d'emetre el bo. No tomba mai qui la crida: una sèrie que no es pot allargar és
 * un disgust per al client, però perdre la renovació sencera perquè una franja
 * estava ocupada seria molt pitjor.
 */
export async function extendSeriesForSubscription(
  subscription: Subscription,
): Promise<ExtensionOutcome[]> {
  const series = await listSeriesToExtend(
    subscription.clientId,
    subscription.serviceType,
  );
  const out: ExtensionOutcome[] = [];

  for (const s of series) {
    try {
      out.push(await extendOne(s));
    } catch (e) {
      console.error(`[sèries] no s'ha pogut allargar ${s.id}:`, e);
      out.push({ seriesId: s.id, created: 0, waitlisted: 0, failed: 1 });
    }
  }
  return out;
}

async function extendOne(s: SeriesToExtend): Promise<ExtensionOutcome> {
  const empty = { seriesId: s.id, created: 0, waitlisted: 0, failed: 0 };

  // Quantes en falten segons els límits de la PRÒPIA sèrie.
  const wanted =
    s.occurrenceCount === null ? null : s.occurrenceCount - s.placed;
  if (wanted !== null && wanted <= 0)
    return { ...empty, skipped: "limitReached" };

  // On continua el patró. Sense cap ocurrència col·locada es parteix de la
  // sessió d'origen; sense cap de les dues no hi ha patró que seguir.
  const anchor = s.lastAt ?? s.firstAt;
  if (!anchor) return { ...empty, skipped: "noPattern" };
  if (!s.baseTrainerId) return { ...empty, skipped: "noTrainer" };

  const req: SeriesRequest = {
    profileId: s.profileId,
    firstAt: nextAfter(anchor, s.frequency),
    trainerId: s.baseTrainerId,
    serviceType: s.serviceType,
    frequency: s.frequency,
    endDate: s.endDate,
    occurrenceCount: wanted,
    bookOnlyAvailable: s.bookOnlyAvailable,
    // Mai. Veure la decisió 2 de la capçalera.
    allowAlternatives: false,
    allowWaitlist: s.allowWaitlist,
  };

  // `resolveSeries` ja talla pel bo: genera fins on arriben les sessions del
  // mes que s'acaba d'emetre i compta la resta a `skippedForBono`. Aquest mes
  // reserva el que pot; el que en quedi fora, el mes vinent.
  const plan = await resolveSeries(req);
  if (plan.error) return { ...empty, failed: 1 };

  const decided = plan.occurrences.filter(
    (o) => o.status === "confirmada" || o.status === "llista_espera",
  );
  if (decided.length === 0) return empty;

  const result = await applyOccurrences(req, decided, s.id);
  return {
    seriesId: s.id,
    created: result.created,
    waitlisted: result.waitlisted,
    failed: result.failed,
  };
}

/**
 * L'instant de la següent ocurrència després d'una altra.
 *
 * Es calcula en hora del CENTRE i es torna a convertir a instant, igual que fa
 * `resolveSeries`: sumar 7×24 h sobre l'instant cru semblaria equivalent i no ho
 * és —creuant el canvi d'hora la sèrie es desplaçaria una hora—, i qui reserva
 * "cada dijous a les 10" espera les 10 tot l'any.
 */
function nextAfter(iso: string, frequency: BookingFrequency): string {
  const at = new Date(iso);
  const day = centerDateStr(at);
  const hour = centerHour(at);
  const next = nextOccurrence(new Date(`${day}T00:00:00Z`), frequency);
  return centerLocalToInstant(
    next.toISOString().slice(0, 10),
    `${String(hour).padStart(2, "0")}:00`,
  ).toISOString();
}

// ─── Lectura ────────────────────────────────────────────────────────────────

async function listSeriesToExtend(
  clientId: string,
  serviceType: ServiceType,
): Promise<SeriesToExtend[]> {
  if (USE_MOCK) {
    const store = getStore();
    const profileId =
      store.clients.find((c) => c.id === clientId)?.profile_id ?? null;
    if (!profileId) return [];

    return store.booking_series
      .filter(
        (s) =>
          s.client_id === clientId &&
          s.service_type === serviceType &&
          s.status === "active" &&
          s.auto_extend,
      )
      .map((s) => {
        const res = store.reservations.filter((r) => r.series_id === s.id);
        const waits = store.waitlist_entries.filter((w) => w.series_id === s.id);
        const lastAt = res
          .map((r) => r.scheduled_at)
          .sort()
          .at(-1);
        return {
          id: s.id,
          clientId,
          profileId,
          serviceType: s.service_type,
          frequency: s.frequency,
          baseTrainerId: s.base_trainer_id,
          endDate: s.end_date,
          occurrenceCount: s.occurrence_count,
          bookOnlyAvailable: s.book_only_available,
          allowWaitlist: s.allow_waitlist,
          firstAt: s.first_at,
          placed: res.length + waits.length,
          lastAt: lastAt ?? null,
        };
      });
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client?.profile_id) return [];

  const { data: series, error } = await admin
    .from("booking_series")
    .select(
      "id, service_type, frequency, base_trainer_id, end_date, occurrence_count, book_only_available, allow_waitlist, first_at",
    )
    .eq("client_id", clientId)
    .eq("service_type", serviceType)
    .eq("status", "active")
    .eq("auto_extend", true);
  if (error) throw error;
  if (!series || series.length === 0) return [];

  const ids = series.map((s) => s.id);
  const [{ data: res }, { data: waits }] = await Promise.all([
    admin.from("reservations").select("series_id, scheduled_at").in("series_id", ids),
    admin.from("waitlist_entries").select("series_id").in("series_id", ids),
  ]);

  return series.map((s) => {
    const mine = (res ?? []).filter((r) => r.series_id === s.id);
    const lastAt = mine
      .map((r) => r.scheduled_at)
      .sort()
      .at(-1);
    return {
      id: s.id,
      clientId,
      profileId: client.profile_id,
      serviceType: s.service_type,
      frequency: s.frequency,
      baseTrainerId: s.base_trainer_id,
      endDate: s.end_date,
      occurrenceCount: s.occurrence_count,
      bookOnlyAvailable: s.book_only_available,
      allowWaitlist: s.allow_waitlist,
      firstAt: s.first_at,
      placed: mine.length + (waits ?? []).filter((w) => w.series_id === s.id).length,
      lastAt: lastAt ?? null,
    };
  });
}
