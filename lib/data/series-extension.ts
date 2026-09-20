import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import {
  centerDateStr,
  centerSlot,
  centerLocalToInstant,
} from "@/lib/center-time";
import { slotToHHMM } from "@/lib/availability-slots";
import { nextOccurrence } from "@/lib/booking-series-core";
import { canRepeatInSeries } from "@/lib/series-rules";
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
  // ─── AVUI AIXÒ NO ALLARGA RES, PERÒ NO ÉS UNA FUNCIÓ MORTA ────────────────
  //
  // Una reserva de grup no es pot repetir en bucle, i el motiu és l'aforament:
  // quatre places no aguanten una sèrie eterna (vegeu `lib/series-rules.ts`).
  // Com que totes les subscripcions que hi ha ara mateix són de
  // 'grupo_reducido', la condició falla per a totes i aquest `return` és
  // l'única sortida que s'executa.
  //
  // ABANS AQUÍ HI DEIA QUE «LA 0074 QUEDA RETIRADA». JA NO ÉS VERITAT.
  //
  // Ho era mentre les subscripcions estaven clavades a 'grupo_reducido' per un
  // check de la 0072: si l'únic servei subscribible era el de grup i les sèries
  // de grup no existien, cap subscripció podria allargar-ne mai cap. La 0086 ha
  // tret aquell check i ha mogut la decisió a una casella del catàleg. A partir
  // d'ara, l'administració pot marcar «només per subscripció» un paquet de
  // fisioteràpia o d'entrenament individual des d'una pantalla, sense migració
  // ni desplegament —i el primer dia que ho faci, la condició de sobre passarà a
  // ser certa i AIXÒ TORNARÀ A ALLARGAR SÈRIES TOT SOL.
  //
  // Això és el comportament desitjat i no un descuit: una sèrie individual no
  // bloqueja cap aforament, i que es renovi amb la subscripció és justament el
  // que la 0074 va venir a fer. Es diu aquí, en veu alta, perquè el canvi
  // arribarà per una casella i no per un commit, i qui llegeixi aquest fitxer
  // el dia que passi ha de saber que estava previst.
  //
  // PER QUÈ EL TALL ÉS AQUÍ I NO MÉS AMUNT. El que s'atura és generar
  // ocurrències NOVES. Tota la resta de la 0074 —les sèries vives, les seves
  // ocurrències ja reservades, el recompte, la cancel·lació sencera des de «Les
  // meves sèries»— segueix funcionant igual. Hi ha sèries de grup creades abans
  // de la regla amb sessions ja reservades al calendari, i aquelles són seves:
  // es respecten i s'esgoten soles quan arribin al seu límit. No se'n cancel·la
  // ni una.
  //
  // PER QUÈ ES MIRA EL TIPUS I NO LA CASELLA DEL PAQUET. Perquè el que decideix
  // si una sèrie pot allargar-se és si bloqueja places, no com es paga. Un 'Bo
  // de 6 sessions' de grup no porta la casella i tot i així no es pot repetir;
  // un paquet individual que la porti, sí. Mirar `subscription_only` aquí seria
  // tornar a confondre les dues idees que la 0086 ha separat.
  if (!canRepeatInSeries(subscription.serviceType)) return [];

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

  // `resolveSeries` ja talla per les sessions: genera fins on arriben les de
  // TOTS els bons utilitzables —el del mes que s'acaba d'emetre, el que pugui
  // quedar d'abans i la sessió extra si n'hi ha— i compta la resta a
  // `skippedForBono`. Aquest mes reserva el que pot; el que en quedi fora, el
  // mes vinent.
  //
  // Comptava només el més antic, i això deixava l'extensió coixa en silenci:
  // amb un bo vell d'una sessió per gastar, el cron n'allargava UNA en comptes
  // de les vuit del cicle nou. Es recuperava sol el mes següent, però el
  // client havia perdut el mes.
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
  // L'hora de rellotge SENCERA, amb els minuts. Abans era `centerHour` i es
  // reconstruïa com "HH:00": una sèrie de les 9:30 s'hauria anat prolongant
  // sola a les 9:00, i pel cron, sense que ningú ho veiés passar.
  const time = slotToHHMM(centerSlot(at));
  const next = nextOccurrence(new Date(`${day}T00:00:00Z`), frequency);
  return centerLocalToInstant(
    next.toISOString().slice(0, 10),
    time,
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
