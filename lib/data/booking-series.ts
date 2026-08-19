import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { isBonoExpired } from "@/lib/data/bonos";
import { slotHasRoom, createClientReservation, cancelClientReservation } from "@/lib/data/reservations";
import { addToWaitlist, slotKeyOf } from "@/lib/data/waitlist";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { listAllBlocksLite } from "@/lib/data/availability-blocks";
import {
  isServiceAvailableOn,
  isInstantBlocked,
  blocksOf,
} from "@/lib/availability-slots";
import {
  centerDateStr,
  centerHour,
  centerWeekday,
  centerLocalToInstant,
} from "@/lib/center-time";
import { getCenterSettings } from "@/lib/data/center-settings";
import {
  generateOccurrences,
  localDayString,
  type ResolvedOccurrence,
} from "@/lib/booking-series-core";
import type { BookingFrequency, ServiceType } from "@/types/database";

/**
 * Reserva en bucle: generar les dates, mirar què hi cap i deixar-ho tot escrit
 * d'una tacada.
 *
 * El càlcul (`resolveSeries`) i l'escriptura (`commitSeries`) van separats a
 * propòsit: el pas 2 de l'assistent ensenya el resultat SENSE haver reservat
 * res, i fins que no es prem "Confirmar sèrie" a la base no hi ha res. Així el
 * client pot canviar la freqüència, acceptar alternatives o fer-se enrere sense
 * deixar mitja sèrie a mig fer.
 */

export type SeriesRequest = {
  profileId: string;
  /** La sessió inicial triada al calendari. */
  firstAt: string;
  trainerId: string;
  serviceType: ServiceType;
  frequency: BookingFrequency;
  endDate?: string | null;
  occurrenceCount?: number | null;
  bookOnlyAvailable: boolean;
  allowAlternatives: boolean;
  allowWaitlist: boolean;
};

export type SeriesPlan = {
  occurrences: ResolvedOccurrence[];
  /** Sessions que li queden al bo que es farà servir. */
  bonoRemaining: number;
  bonoId: string | null;
  error?: string;
};

type SlotRow = {
  trainer_id: string | null;
  scheduled_at: string;
  service_type: ServiceType;
};

/**
 * Calcula com quedaria la sèrie, sense escriure res.
 *
 * L'ordre de decisió de cada ocurrència és el de l'especificació i s'aplica
 * literalment:
 *   1. Sense sessions al bo → s'atura la generació (no té sentit seguir).
 *   2. Franja exacta lliure → confirmada.
 *   3. Alternativa (si s'hi ha dit que sí) → proposada, no reservada.
 *   4. Llista d'espera (si s'hi ha dit que sí) → a la cua.
 *   5. `bookOnlyAvailable` salta 3 i 4 sencers, encara que els altres dos
 *      estiguin marcats: és l'opció que diu "no em compliquis la vida".
 *   6. Res del que hi ha a sobre → sense places.
 */
export async function resolveSeries(req: SeriesRequest): Promise<SeriesPlan> {
  const first = new Date(req.firstAt);
  if (Number.isNaN(first.getTime()))
    return { occurrences: [], bonoRemaining: 0, bonoId: null, error: "Data no vàlida." };

  const ctx = await loadContext(req);
  if (ctx.error)
    return { occurrences: [], bonoRemaining: 0, bonoId: null, error: ctx.error };

  // Les dates es generen en hora del CENTRE i es tornen a convertir a
  // instants. Sumar 7×24 h sobre l'instant cru semblaria equivalent, però no
  // ho és: creuant el canvi d'hora la sèrie es desplaçaria una hora, i qui
  // reserva "cada dijous a les 10" espera les 10 tot l'any.
  const firstDay = centerDateStr(first);
  const firstHour = centerHour(first);
  const dates = generateOccurrences({
    first: new Date(`${firstDay}T00:00:00Z`),
    frequency: req.frequency,
    endDate: req.endDate,
    occurrenceCount: req.occurrenceCount,
  }).map((d) =>
    centerLocalToInstant(
      d.toISOString().slice(0, 10),
      `${String(firstHour).padStart(2, "0")}:00`,
    ),
  );

  const occurrences: ResolvedOccurrence[] = [];
  // Còpia local de l'ocupació: cada confirmació d'aquesta mateixa sèrie ha de
  // comptar per a les següents (dues ocurrències no poden ocupar la mateixa
  // plaça d'un grup).
  const taken = [...ctx.slots];
  let remaining = ctx.bonoRemaining;

  for (const when of dates) {
    // 1. Sense sessions: s'atura la sèrie aquí.
    if (remaining <= 0) break;

    const iso = when.toISOString();
    const here = taken.filter(
      (s) => s.trainer_id === req.trainerId && s.scheduled_at === iso,
    );

    // 2. La franja exacta, lliure i dins de la disponibilitat del professional.
    if (
      ctx.offers(req.trainerId, when, req.serviceType) &&
      slotHasRoom(here, req.serviceType)
    ) {
      occurrences.push({
        requestedAt: iso,
        requestedTrainerId: req.trainerId,
        status: "confirmada",
      });
      taken.push({
        trainer_id: req.trainerId,
        scheduled_at: iso,
        service_type: req.serviceType,
      });
      remaining -= 1;
      continue;
    }

    // 5. "Només les disponibles" mana sobre la resta.
    if (req.bookOnlyAvailable) {
      occurrences.push({
        requestedAt: iso,
        requestedTrainerId: req.trainerId,
        status: "sense_places",
        note: "La franja estava ocupada.",
      });
      continue;
    }

    // 3. Alternativa.
    if (req.allowAlternatives) {
      const alt = findAlternative(req, when, taken, ctx);
      if (alt) {
        occurrences.push({
          requestedAt: iso,
          requestedTrainerId: req.trainerId,
          status: "alternativa_proposada",
          alternative: alt,
        });
        continue;
      }
    }

    // 4. Llista d'espera.
    if (req.allowWaitlist) {
      occurrences.push({
        requestedAt: iso,
        requestedTrainerId: req.trainerId,
        status: "llista_espera",
      });
      continue;
    }

    // 6. No hi ha res a fer.
    occurrences.push({
      requestedAt: iso,
      requestedTrainerId: req.trainerId,
      status: "sense_places",
      note: "Sense places ni alternativa.",
    });
  }

  return {
    occurrences,
    bonoRemaining: ctx.bonoRemaining,
    bonoId: ctx.bonoId,
  };
}

/**
 * La millor alternativa per a una ocurrència ocupada.
 *
 * Prioritat, en aquest ordre:
 *   a) MATEIX professional, mateix dia, l'hora lliure més propera.
 *   b) MATEIXA hora, un altre professional que ofereixi aquell servei.
 *
 * Primer (a) perquè canviar d'hora el mateix dia trenca menys una rutina que
 * canviar de persona: qui reserva en bucle sol venir pel professional.
 */
function findAlternative(
  req: SeriesRequest,
  when: Date,
  taken: SlotRow[],
  ctx: Ctx,
): ResolvedOccurrence["alternative"] | null {
  const day = centerDateStr(when);
  const hour = centerHour(when);

  const free = (trainerId: string, at: Date) => {
    const iso = at.toISOString();
    const here = taken.filter(
      (s) => s.trainer_id === trainerId && s.scheduled_at === iso,
    );
    return (
      ctx.offers(trainerId, at, req.serviceType) &&
      slotHasRoom(here, req.serviceType)
    );
  };

  // a) Mateix dia, mateix professional: es busca cap enfora (±1 h, ±2 h…).
  for (let delta = 1; delta <= 6; delta++) {
    for (const h of [hour - delta, hour + delta]) {
      if (h < ctx.openingHour || h >= ctx.closingHour) continue;
      // L'hora es construeix en hora del CENTRE i es converteix a instant:
      // `setHours` sobre l'instant faria servir la zona del procés (UTC a
      // Vercel) i buscaria alternatives al mig de la matinada d'aquí.
      const at = centerLocalToInstant(day, `${String(h).padStart(2, "0")}:00`);
      if (at.getTime() <= Date.now()) continue;
      if (free(req.trainerId, at))
        return {
          scheduledAt: at.toISOString(),
          trainerId: req.trainerId,
          trainerName: ctx.trainerName(req.trainerId),
          sameDay: true,
        };
    }
  }

  // b) Mateixa hora, un altre professional.
  for (const t of ctx.trainers) {
    if (t === req.trainerId) continue;
    if (free(t, when))
      return {
        scheduledAt: when.toISOString(),
        trainerId: t,
        trainerName: ctx.trainerName(t),
        // Mateixa hora, un altre professional: el dia no canvia, però el que
        // la UI ha d'explicar és el canvi de persona.
        sameDay: false,
      };
  }

  return null;
}

type Ctx = {
  error?: string;
  bonoId: string | null;
  bonoRemaining: number;
  clientId: string;
  slots: SlotRow[];
  rules: Awaited<ReturnType<typeof listAllTrainerRulesLite>>;
  blocks: Awaited<ReturnType<typeof listAllBlocksLite>>;
  trainers: string[];
  trainerName: (id: string) => string;
  openingHour: number;
  closingHour: number;
  /**
   * Ofereix aquest professional aquest servei en aquest instant?
   *
   * Es resol en hora del CENTRE, no la del procés. És l'error que ens va
   * mossegar a producció: `offeredServices` i companyia llegeixen la data amb
   * els getters LOCALS —estan pensats per al navegador, on local = centre— i
   * a Vercel el procés va en UTC, de manera que una sessió de les 10 del matí
   * d'aquí es comprovava contra les 8 i queia fora de l'horari del centre.
   */
  offers: (trainerId: string, at: Date, service: ServiceType) => boolean;
};

/** Tot el que fa falta per resoldre, demanat d'un sol cop. */
async function loadContext(req: SeriesRequest): Promise<Ctx> {
  const empty: Ctx = {
    bonoId: null,
    bonoRemaining: 0,
    clientId: "",
    slots: [],
    rules: [],
    blocks: [],
    trainers: [],
    trainerName: () => "—",
    openingHour: 7,
    closingHour: 22,
    offers: () => false,
  };
  /** Compartit pels dos backends: la disponibilitat no depèn d'on siguin les dades. */
  const makeOffers =
    (
      rules: Awaited<ReturnType<typeof listAllTrainerRulesLite>>,
      blocks: Awaited<ReturnType<typeof listAllBlocksLite>>,
    ) =>
    (trainerId: string, at: Date, service: ServiceType) => {
      if (isInstantBlocked(blocksOf(blocks, trainerId), at)) return false;
      return isServiceAvailableOn(
        rules.filter((r) => r.trainerId === trainerId),
        centerDateStr(at),
        centerWeekday(at),
        centerHour(at),
        service,
      );
    };

  const settings = await getCenterSettings();

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === req.profileId);
    if (!client) return { ...empty, error: "Client no trobat." };
    const bono = store.bonos
      .filter(
        (b) =>
          b.client_id === client.id &&
          b.service_type === req.serviceType &&
          (b.status === "active" || b.status === "pending_payment") &&
          b.remaining_sessions > 0 &&
          !isBonoExpired(b),
      )
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))[0];
    if (!bono)
      return { ...empty, error: "No tens cap bo actiu d'aquest tipus amb sessions." };
    const names = new Map(
      store.profiles.filter((p) => p.role === "trainer").map((p) => [p.id, p.full_name ?? "—"]),
    );
    const rules = await listAllTrainerRulesLite();
    const blocks = await listAllBlocksLite();
    return {
      bonoId: bono.id,
      bonoRemaining: bono.remaining_sessions,
      clientId: client.id,
      slots: store.reservations
        .filter((r) => r.status === "booked")
        .map((r) => ({
          trainer_id: r.trainer_id,
          scheduled_at: r.scheduled_at,
          service_type: r.service_type,
        })),
      rules,
      blocks,
      trainers: [...names.keys()],
      trainerName: (id) => names.get(id) ?? "—",
      openingHour: settings.openingHour,
      closingHour: settings.closingHour,
      offers: makeOffers(rules, blocks),
    };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", req.profileId)
    .maybeSingle();
  if (!client) return { ...empty, error: "Client no trobat." };

  const [{ data: bonos }, { data: res }, { data: pros }, rules, blocks] =
    await Promise.all([
      admin
        .from("bonos")
        .select("id, remaining_sessions, status, expires_at")
        .eq("client_id", client.id)
        .eq("service_type", req.serviceType)
        .in("status", ["active", "pending_payment"])
        .gt("remaining_sessions", 0)
        .order("purchased_at", { ascending: true }),
      admin
        .from("reservations")
        .select("trainer_id, scheduled_at, service_type")
        .eq("status", "booked"),
      admin.from("profiles").select("id, full_name").eq("role", "trainer"),
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
    ]);

  const bono = (bonos ?? []).find(
    (b) => !isBonoExpired({ status: b.status, expires_at: b.expires_at }),
  );
  if (!bono)
    return { ...empty, error: "No tens cap bo actiu d'aquest tipus amb sessions." };

  const names = new Map((pros ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  return {
    bonoId: bono.id,
    bonoRemaining: bono.remaining_sessions,
    clientId: client.id,
    slots: (res ?? []) as SlotRow[],
    rules,
    blocks,
    trainers: [...names.keys()],
    trainerName: (id) => names.get(id) ?? "—",
    openingHour: settings.openingHour,
    closingHour: settings.closingHour,
    offers: makeOffers(rules, blocks),
  };
}

// ─── Escriptura ─────────────────────────────────────────────────────────────

export type CommitResult = {
  seriesId: string;
  created: number;
  waitlisted: number;
  failed: number;
};

/**
 * Escriu la sèrie sencera: crea la fila de `booking_series`, les reserves
 * (confirmades i alternatives ACCEPTADES) i les entrades de llista d'espera,
 * totes amb el mateix `series_id`.
 *
 * Les reserves passen per `createClientReservation`, la mateixa funció que
 * qualsevol reserva del client: així la sèrie no s'inventa cap camí paral·lel
 * per saltar-se validacions (antelació mínima, disponibilitat, aforament,
 * reclam atòmic de la sessió del bo). Si una ocurrència falla, es compta com a
 * fallida i la resta continua: val més una sèrie incompleta que cap.
 */
export async function commitSeries(
  req: SeriesRequest,
  decided: ResolvedOccurrence[],
): Promise<CommitResult> {
  const ctx = await loadContext(req);
  if (ctx.error) throw new Error(ctx.error);

  const seriesId = await insertSeries(req, ctx.clientId, ctx.bonoId);
  let created = 0;
  let waitlisted = 0;
  let failed = 0;

  for (const o of decided) {
    // Les alternatives només compten si el client hi ha dit que sí (la UI les
    // marca com a 'confirmada' en acceptar-les).
    if (o.status === "confirmada") {
      const at = o.alternative?.scheduledAt ?? o.requestedAt;
      const trainerId = o.alternative?.trainerId ?? o.requestedTrainerId;
      if (!trainerId) {
        failed++;
        continue;
      }
      try {
        await createClientReservation({
          profileId: req.profileId,
          trainerId,
          serviceType: req.serviceType,
          scheduledAt: at,
        });
        await tagReservation(trainerId, at, ctx.clientId, seriesId);
        created++;
      } catch {
        failed++;
      }
      continue;
    }

    if (o.status === "llista_espera") {
      const { date, time } = slotKeyOf(o.requestedAt);
      try {
        await addToWaitlist({
          clientId: ctx.clientId,
          bonoId: ctx.bonoId,
          serviceType: req.serviceType,
          trainerId: o.requestedTrainerId,
          desiredDate: date,
          desiredTime: time,
          seriesId,
        });
        waitlisted++;
      } catch {
        failed++;
      }
    }
  }

  return { seriesId, created, waitlisted, failed };
}

/**
 * Marca la reserva acabada de crear amb el `series_id`.
 *
 * `createClientReservation` no en sap res de sèries —i millor que segueixi
 * així—, de manera que l'etiqueta es posa just després buscant la fila per la
 * seva clau natural (client + professional + instant).
 */
async function tagReservation(
  trainerId: string,
  scheduledAt: string,
  clientId: string,
  seriesId: string,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find(
      (x) =>
        x.client_id === clientId &&
        x.trainer_id === trainerId &&
        x.scheduled_at === scheduledAt &&
        x.status === "booked",
    );
    if (r) r.series_id = seriesId;
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  await admin
    .from("reservations")
    .update({ series_id: seriesId })
    .eq("client_id", clientId)
    .eq("trainer_id", trainerId)
    .eq("scheduled_at", scheduledAt)
    .eq("status", "booked");
}

async function insertSeries(
  req: SeriesRequest,
  clientId: string,
  bonoId: string | null,
): Promise<string> {
  const row = {
    client_id: clientId,
    bono_id: bonoId,
    service_type: req.serviceType,
    base_trainer_id: req.trainerId,
    frequency: req.frequency,
    end_date: req.endDate ?? null,
    occurrence_count: req.occurrenceCount ?? null,
    book_only_available: req.bookOnlyAvailable,
    allow_alternatives: req.allowAlternatives,
    allow_waitlist: req.allowWaitlist,
  };

  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.booking_series.push({ id, ...row, created_at: new Date().toISOString() });
    saveStore(store);
    return id;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("booking_series")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) throw new Error("No s'ha pogut desar la sèrie.");
  return data.id;
}

// ─── Cancel·lar tota la sèrie ───────────────────────────────────────────────

/**
 * Cancel·la totes les reserves FUTURES d'una sèrie.
 *
 * Itera cridant `cancelClientReservation`, que és la mateixa cancel·lació
 * d'una reserva solta: comprova que sigui teva, que es pugui cancel·lar encara,
 * retorna la sessió al bo, avisa el professional i —des d'avui— fa entrar qui
 * esperava aquella franja. Aquí no es repeteix res d'això.
 *
 * Les que no es puguin cancel·lar (per l'antelació mínima) es compten i es
 * diuen: la resta sí que cau, i el client sap exactament què li queda.
 */
export async function cancelSeries(
  profileId: string,
  seriesId: string,
): Promise<{ cancelled: number; kept: number }> {
  const nowISO = new Date().toISOString();
  let ids: string[] = [];

  if (USE_MOCK) {
    ids = getStore()
      .reservations.filter(
        (r) =>
          r.series_id === seriesId &&
          r.status === "booked" &&
          r.scheduled_at > nowISO,
      )
      .map((r) => r.id);
  } else {
    const admin = createAdminClient();
    const { data } = await admin
      .from("reservations")
      .select("id")
      .eq("series_id", seriesId)
      .eq("status", "booked")
      .gt("scheduled_at", nowISO);
    ids = (data ?? []).map((r) => r.id);
  }

  let cancelled = 0;
  let kept = 0;
  for (const id of ids) {
    try {
      await cancelClientReservation(profileId, id);
      cancelled++;
    } catch {
      kept++;
    }
  }

  // Les esperes de la sèrie ja no tenen sentit: si el client la cancel·la
  // sencera, no vol que d'aquí a tres dies li aparegui una plaça d'aquella cua.
  await cancelSeriesWaitlist(seriesId);
  return { cancelled, kept };
}

async function cancelSeriesWaitlist(seriesId: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    for (const w of store.waitlist_entries)
      if (w.series_id === seriesId && w.status === "waiting") w.status = "cancelled";
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  await admin
    .from("waitlist_entries")
    .update({ status: "cancelled" })
    .eq("series_id", seriesId)
    .eq("status", "waiting");
}

// ─── Lectura per a la UI ────────────────────────────────────────────────────

export type SeriesSummary = {
  id: string;
  serviceType: ServiceType;
  frequency: BookingFrequency;
  /** Reserves futures que encara viuen. */
  upcoming: number;
  nextAt: string | null;
};

/** Les sèries amb reserves futures d'un client. */
export async function listActiveSeries(clientId: string): Promise<SeriesSummary[]> {
  const nowISO = new Date().toISOString();

  if (USE_MOCK) {
    const store = getStore();
    return store.booking_series
      .filter((s) => s.client_id === clientId)
      .map((s) => {
        const future = store.reservations
          .filter(
            (r) =>
              r.series_id === s.id && r.status === "booked" && r.scheduled_at > nowISO,
          )
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
        return {
          id: s.id,
          serviceType: s.service_type,
          frequency: s.frequency,
          upcoming: future.length,
          nextAt: future[0]?.scheduled_at ?? null,
        };
      })
      .filter((s) => s.upcoming > 0);
  }

  const admin = createAdminClient();
  const { data: series } = await admin
    .from("booking_series")
    .select("id, service_type, frequency")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (!series || series.length === 0) return [];

  const { data: res } = await admin
    .from("reservations")
    .select("series_id, scheduled_at")
    .in("series_id", series.map((s) => s.id))
    .eq("status", "booked")
    .gt("scheduled_at", nowISO)
    .order("scheduled_at", { ascending: true });

  return series
    .map((s) => {
      const future = (res ?? []).filter((r) => r.series_id === s.id);
      return {
        id: s.id,
        serviceType: s.service_type,
        frequency: s.frequency,
        upcoming: future.length,
        nextAt: future[0]?.scheduled_at ?? null,
      };
    })
    .filter((s) => s.upcoming > 0);
}

export { localDayString };
