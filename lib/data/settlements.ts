import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICE_TYPES } from "@/lib/labels";
import type { ServiceType, SettlementBreakdownLine } from "@/types/database";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ─── Tipus ───────────────────────────────────────────────────────────────────

export type ServiceRate = {
  id: string;
  serviceType: ServiceType;
  rateAmount: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdAt: string;
};

export type Settlement = {
  id: string;
  trainerId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  breakdown: SettlementBreakdownLine[];
  generatedAt: string;
  generatedBy: string | null;
};

/** Resultat d'un càlcul en viu, encara no desat. */
export type SettlementPreview = {
  trainerId: string;
  periodStart: string;
  periodEnd: string;
  lines: SettlementBreakdownLine[];
  total: number;
  /** Sessions completades sense cap tarifa vigent el seu dia. */
  unratedSessions: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function rowToRate(r: {
  id: string;
  service_type: string;
  rate_amount: number | string;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
}): ServiceRate {
  return {
    id: r.id,
    serviceType: r.service_type as ServiceType,
    rateAmount: Number(r.rate_amount),
    effectiveFrom: r.effective_from,
    effectiveUntil: r.effective_until,
    createdAt: r.created_at,
  };
}

/** Data local (Europe/Madrid ja és la zona del centre) en format YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Tarifa vigent per a un dia concret.
 *
 * Funció pura: rep totes les tarifes del centre i tria la que cobreix `day`.
 * No depèn del professional — la tarifa d'un servei és la mateixa per a
 * tothom. Si n'hi hagués més d'una (dades inconsistents), guanya la de
 * `effective_from` més recent, que és la darrera que es va crear.
 */
export function rateOn(
  rates: ServiceRate[],
  serviceType: ServiceType,
  day: string,
): ServiceRate | null {
  const candidates = rates.filter(
    (r) =>
      r.serviceType === serviceType &&
      r.effectiveFrom <= day &&
      (r.effectiveUntil === null || r.effectiveUntil >= day),
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom),
  )[0];
}

// ─── Tarifes ────────────────────────────────────────────────────────────────

/** Totes les tarifes del centre, històric inclòs. */
export async function listRates(): Promise<ServiceRate[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore().service_rates.map(rowToRate);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_rates")
    .select(
      "id, service_type, rate_amount, effective_from, effective_until, created_at",
    )
    .order("effective_from", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRate);
}

/** Tarifes vigents avui, indexades per servei. */
export async function currentRateMap(): Promise<Map<ServiceType, ServiceRate>> {
  const all = await listRates();
  const today = todayStr();
  const map = new Map<ServiceType, ServiceRate>();
  for (const st of SERVICE_TYPES) {
    const r = rateOn(all, st, today);
    if (r) map.set(st, r);
  }
  return map;
}

/**
 * Fixa una tarifa nova sense destruir l'anterior: tanca la vigent a ahir i
 * insereix la nova a partir d'avui.
 *
 * Cas límit: si la vigent ja començava avui (s'ha editat dues vegades el
 * mateix dia), tancar-la a ahir la deixaria amb un període invàlid, així que
 * s'esborra en comptes de tancar-la. No es perd històric real, perquè aquella
 * fila no va arribar a estar vigent cap dia sencer.
 */
export async function setRate(
  serviceType: ServiceType,
  rateAmount: number,
): Promise<void> {
  const today = todayStr();
  const yesterday = shiftDay(today, -1);

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const current = rateOn(store.service_rates.map(rowToRate), serviceType, today);
    if (current) {
      if (current.effectiveFrom >= today) {
        store.service_rates = store.service_rates.filter((r) => r.id !== current.id);
      } else {
        const row = store.service_rates.find((r) => r.id === current.id);
        if (row) row.effective_until = yesterday;
      }
    }
    store.service_rates.push({
      id: crypto.randomUUID(),
      service_type: serviceType,
      rate_amount: rateAmount,
      effective_from: today,
      effective_until: null,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const current = rateOn(await listRates(), serviceType, today);

  if (current) {
    if (current.effectiveFrom >= today) {
      const { error } = await admin
        .from("service_rates")
        .delete()
        .eq("id", current.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("service_rates")
        .update({ effective_until: yesterday })
        .eq("id", current.id);
      if (error) throw new Error(error.message);
    }
  }

  const { error } = await admin.from("service_rates").insert({
    service_type: serviceType,
    rate_amount: rateAmount,
    effective_from: today,
    effective_until: null,
  });
  if (error) throw new Error(error.message);
}

// ─── Càlcul ─────────────────────────────────────────────────────────────────

type CompletedSession = { day: string; serviceType: ServiceType };

/** Sessions completades d'un professional dins del període (dates incloses). */
async function completedSessions(
  trainerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CompletedSession[]> {
  // El període es dona en dates locals; el filtre es fa sobre l'instant, des
  // del primer moment de periodStart fins al primer moment del dia següent a
  // periodEnd (exclòs), per no perdre les sessions de la tarda del darrer dia.
  const fromISO = new Date(`${periodStart}T00:00:00`).toISOString();
  const toISO = new Date(`${shiftDay(periodEnd, 1)}T00:00:00`).toISOString();

  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore()
      .reservations.filter(
        (r) =>
          r.trainer_id === trainerId &&
          r.status === "completed" &&
          r.scheduled_at >= fromISO &&
          r.scheduled_at < toISO,
      )
      .map((r) => ({
        day: new Date(r.scheduled_at).toISOString().slice(0, 10),
        serviceType: r.service_type,
      }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("scheduled_at, service_type")
    .eq("trainer_id", trainerId)
    .eq("status", "completed")
    .gte("scheduled_at", fromISO)
    .lt("scheduled_at", toISO);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    day: r.scheduled_at.slice(0, 10),
    serviceType: r.service_type,
  }));
}

/**
 * Calcula la liquidació d'un període SENSE desar-la.
 *
 * Cada sessió es valora amb la tarifa vigent el dia que es va fer, no amb la
 * d'avui: si la tarifa va canviar a mitja liquidació, cada sessió porta la
 * seva. Per això `rate` d'una línia és `null` quan dins d'aquell servei s'hi
 * han barrejat tarifes diferents — l'import continua sent la suma exacta.
 */
export async function computeSettlement(
  trainerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SettlementPreview> {
  const [sessions, rates] = await Promise.all([
    completedSessions(trainerId, periodStart, periodEnd),
    listRates(),
  ]);

  const acc = new Map<
    ServiceType,
    { sessions: number; amount: number; ratesSeen: Set<number> }
  >();
  let unratedSessions = 0;

  for (const s of sessions) {
    const rate = rateOn(rates, s.serviceType, s.day);
    if (!rate) {
      unratedSessions++;
      continue;
    }
    const entry =
      acc.get(s.serviceType) ?? { sessions: 0, amount: 0, ratesSeen: new Set() };
    entry.sessions += 1;
    entry.amount += rate.rateAmount;
    entry.ratesSeen.add(rate.rateAmount);
    acc.set(s.serviceType, entry);
  }

  const lines: SettlementBreakdownLine[] = SERVICE_TYPES.filter((st) =>
    acc.has(st),
  ).map((st) => {
    const e = acc.get(st)!;
    return {
      serviceType: st,
      sessions: e.sessions,
      rate: e.ratesSeen.size === 1 ? [...e.ratesSeen][0] : null,
      amount: Math.round(e.amount * 100) / 100,
    };
  });

  return {
    trainerId,
    periodStart,
    periodEnd,
    lines,
    total: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    unratedSessions,
  };
}

// ─── Liquidacions desades ───────────────────────────────────────────────────

export async function listSettlements(trainerId?: string): Promise<Settlement[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore()
      .settlements.filter((s) => !trainerId || s.trainer_id === trainerId)
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
      .map((s) => ({
        id: s.id,
        trainerId: s.trainer_id,
        periodStart: s.period_start,
        periodEnd: s.period_end,
        totalAmount: Number(s.total_amount),
        breakdown: s.session_breakdown,
        generatedAt: s.generated_at,
        generatedBy: s.generated_by,
      }));
  }

  const supabase = await createClient();
  let query = supabase
    .from("settlements")
    .select(
      "id, trainer_id, period_start, period_end, total_amount, session_breakdown, generated_at, generated_by",
    )
    .order("generated_at", { ascending: false });
  if (trainerId) query = query.eq("trainer_id", trainerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    trainerId: s.trainer_id,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    totalAmount: Number(s.total_amount),
    breakdown: (s.session_breakdown ?? []) as SettlementBreakdownLine[],
    generatedAt: s.generated_at,
    generatedBy: s.generated_by,
  }));
}

/**
 * Desa el resultat d'un càlcul. El desglossament es guarda tal com s'ha
 * calculat: a partir d'aquí la liquidació és immutable i no depèn de les
 * tarifes, que poden canviar l'endemà.
 */
export async function createSettlement(
  preview: SettlementPreview,
  generatedBy: string | null,
): Promise<string> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const id = crypto.randomUUID();
    store.settlements.push({
      id,
      trainer_id: preview.trainerId,
      period_start: preview.periodStart,
      period_end: preview.periodEnd,
      total_amount: preview.total,
      session_breakdown: preview.lines,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
    });
    saveStore(store);
    return id;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("settlements")
    .insert({
      trainer_id: preview.trainerId,
      period_start: preview.periodStart,
      period_end: preview.periodEnd,
      total_amount: preview.total,
      session_breakdown: preview.lines,
      generated_by: generatedBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}
