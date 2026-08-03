import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICE_TYPES } from "@/lib/labels";
import { centerToday } from "@/lib/center-time";
import { completedSessions, shiftDay } from "@/lib/data/completed-sessions";
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
  /** Ruta del PDF al Storage. Null = liquidació sense document generat. */
  invoicePath: string | null;
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

const SETTLEMENT_COLUMNS =
  "id, trainer_id, period_start, period_end, total_amount, session_breakdown, generated_at, generated_by, invoice_path";

function rowToSettlement(s: {
  id: string;
  trainer_id: string;
  period_start: string;
  period_end: string;
  total_amount: number | string;
  session_breakdown: SettlementBreakdownLine[] | null;
  generated_at: string;
  generated_by: string | null;
  invoice_path?: string | null;
}): Settlement {
  return {
    id: s.id,
    trainerId: s.trainer_id,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    totalAmount: Number(s.total_amount),
    breakdown: (s.session_breakdown ?? []) as SettlementBreakdownLine[],
    generatedAt: s.generated_at,
    generatedBy: s.generated_by,
    invoicePath: s.invoice_path ?? null,
  };
}

/**
 * Avui segons el rellotge del centre (YYYY-MM-DD).
 *
 * Abans feia `toISOString().slice(0,10)`, que és el dia UTC: el comentari deia
 * "hora local" i el codi no ho complia, de manera que entre mitjanit i les 2
 * una tarifa nova es donava d'alta amb la data d'ahir.
 */
function todayStr(): string {
  return centerToday();
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
      .map(rowToSettlement);
  }

  const supabase = await createClient();
  let query = supabase
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .order("generated_at", { ascending: false });
  if (trainerId) query = query.eq("trainer_id", trainerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSettlement);
}

/** Una liquidació concreta. La RLS ja limita qui la pot llegir. */
export async function getSettlement(id: string): Promise<Settlement | null> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const row = getStore().settlements.find((s) => s.id === id);
    return row ? rowToSettlement(row) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToSettlement(data) : null;
}

/** Ja hi ha una liquidació desada per a aquest professional i període exacte? */
export async function findSettlementForPeriod(
  trainerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<Settlement | null> {
  const all = await listSettlements(trainerId);
  return (
    all.find(
      (s) => s.periodStart === periodStart && s.periodEnd === periodEnd,
    ) ?? null
  );
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
      invoice_path: null,
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

/** Enganxa el PDF ja pujat a la liquidació. */
export async function setSettlementInvoicePath(
  settlementId: string,
  invoicePath: string | null,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const row = store.settlements.find((s) => s.id === settlementId);
    if (row) row.invoice_path = invoicePath;
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("settlements")
    .update({ invoice_path: invoicePath })
    .eq("id", settlementId);
  if (error) throw new Error(error.message);
}

/**
 * Esborra una liquidació.
 *
 * NO és una operació de negoci: una liquidació desada no s'edita mai (és la
 * fotografia del càlcul). Existeix només per desfer una generació que ha
 * fallat a mig camí i deixar-ho tot com estava, de manera que l'admin pugui
 * tornar-ho a provar sense quedar-se una liquidació sense document.
 */
export async function deleteSettlement(settlementId: string): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    store.settlements = store.settlements.filter((s) => s.id !== settlementId);
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("settlements")
    .delete()
    .eq("id", settlementId);
  if (error) throw new Error(error.message);
}
