import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICE_TYPES } from "@/lib/labels";
import type {
  ServiceType,
  BonusPayoutFrequency,
  BonusTierLine,
} from "@/types/database";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ─── Tipus ───────────────────────────────────────────────────────────────────

export type BonusWeight = {
  id: string;
  serviceType: ServiceType;
  weight: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export type BonusTier = {
  id: string;
  minUnits: number;
  /** null = tram obert (l'últim). */
  maxUnits: number | null;
  ratePerUnit: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export type WorkerBonusSettings = {
  trainerId: string;
  payoutFrequency: BonusPayoutFrequency;
  enabled: boolean;
};

export type BonusPayout = {
  id: string;
  trainerId: string;
  periodStart: string;
  periodEnd: string;
  totalUnits: number;
  totalAmount: number;
  tierBreakdown: BonusTierLine[];
  generatedAt: string;
  generatedBy: string | null;
};

export type BonusPeriod = {
  start: string;
  end: string;
  /** "Any 2026", "Bienni 2025–2026". */
  label: string;
};

/** Estat del bonus d'un professional dins del període en curs. */
export type BonusProgress = {
  trainerId: string;
  period: BonusPeriod;
  frequency: BonusPayoutFrequency;
  /** Sessions comptades, per servei, amb les unitats que han aportat. */
  perService: { serviceType: ServiceType; sessions: number; units: number }[];
  totalUnits: number;
  lines: BonusTierLine[];
  totalAmount: number;
  /** Tram on cau la unitat següent, si n'hi ha cap definit. */
  currentTier: BonusTier | null;
  /** Unitats que falten per entrar al tram següent. null si ja és l'últim. */
  unitsToNextTier: number | null;
  /** Sessions completades sense cap pes vigent el seu dia. */
  unweightedSessions: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Vigent el dia `day`, prenent la de `effective_from` més recent si n'hi ha més d'una. */
function vigentOn<T extends { effectiveFrom: string; effectiveUntil: string | null }>(
  rows: T[],
  day: string,
): T[] {
  return rows.filter(
    (r) => r.effectiveFrom <= day && (r.effectiveUntil === null || r.effectiveUntil >= day),
  );
}

/**
 * Any en què comença el bienni que conté `year`.
 *
 * Els biennis són parelles FIXES del calendari que arrenquen en any senar:
 * 2025–2026, 2027–2028, 2029–2030… No depenen de quan es va activar el bonus
 * de cada treballador, de manera que dos professionals tenen sempre el mateix
 * període i els seus números són comparables. La contrapartida, assumida: qui
 * entra a mig bienni té un primer període efectiu més curt.
 */
function biennumStart(year: number): number {
  return year - ((year - 1) % 2);
}

/**
 * Període de bonus que conté `ref` segons la freqüència.
 * Anual: any natural. Biennal: dos anys naturals consecutius.
 */
export function periodFor(
  frequency: BonusPayoutFrequency,
  ref: Date = new Date(),
): BonusPeriod {
  const y = ref.getFullYear();
  if (frequency === "annual") {
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `Any ${y}` };
  }
  const from = biennumStart(y);
  return {
    start: `${from}-01-01`,
    end: `${from + 1}-12-31`,
    label: `Bienni ${from}–${from + 1}`,
  };
}

/**
 * El període en curs i els `count` anteriors, del més recent al més antic.
 * Serveix per poder tancar un període passat des del panell de l'admin.
 */
export function recentPeriods(
  frequency: BonusPayoutFrequency,
  count = 4,
  ref: Date = new Date(),
): BonusPeriod[] {
  const step = frequency === "annual" ? 1 : 2;
  const out: BonusPeriod[] = [];
  for (let i = 0; i < count; i++) {
    out.push(periodFor(frequency, new Date(ref.getFullYear() - i * step, 0, 1)));
  }
  return out;
}

/** Pes vigent d'un servei un dia concret. */
export function weightOn(
  weights: BonusWeight[],
  serviceType: ServiceType,
  day: string,
): BonusWeight | null {
  const c = vigentOn(
    weights.filter((w) => w.serviceType === serviceType),
    day,
  );
  if (c.length === 0) return null;
  return c.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

/**
 * Reparteix `units` entre els trams, PROGRESSIVAMENT: cada tram cobra només
 * la part de les unitats que hi cau, com els trams d'IRPF. Superar el llindar
 * no reetiqueta les unitats de sota al preu nou.
 *
 * Funció pura, sense IO: és el nucli del sistema i ha de ser trivial de provar.
 */
export function applyTiers(
  units: number,
  tiers: BonusTier[],
): { lines: BonusTierLine[]; total: number } {
  const ordered = [...tiers].sort((a, b) => a.minUnits - b.minUnits);
  const lines: BonusTierLine[] = [];

  for (const t of ordered) {
    const top = t.maxUnits ?? Infinity;
    const unitsInTier = Math.max(0, Math.min(units, top) - t.minUnits);
    if (unitsInTier <= 0) continue;
    lines.push({
      minUnits: t.minUnits,
      maxUnits: t.maxUnits,
      ratePerUnit: t.ratePerUnit,
      unitsInTier: round2(unitsInTier),
      amount: round2(unitsInTier * t.ratePerUnit),
    });
  }

  return { lines, total: round2(lines.reduce((s, l) => s + l.amount, 0)) };
}

/**
 * Comprova que un conjunt de trams és utilitzable: ordenats, sense forats ni
 * solapaments, i amb com a màxim un tram obert, que ha de ser l'últim.
 *
 * El solapament no es pot expressar amb un CHECK de fila a Postgres, així que
 * la garantia viu aquí, abans de desar.
 */
export function validateTiers(
  tiers: { minUnits: number; maxUnits: number | null; ratePerUnit: number }[],
): string | null {
  if (tiers.length === 0) return "Cal com a mínim un tram.";

  const ordered = [...tiers].sort((a, b) => a.minUnits - b.minUnits);

  if (ordered[0].minUnits !== 0)
    return "El primer tram ha de començar a 0 unitats.";

  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i];
    if (!Number.isFinite(t.minUnits) || t.minUnits < 0)
      return "Els mínims han de ser números positius.";
    if (!Number.isFinite(t.ratePerUnit) || t.ratePerUnit < 0)
      return "Els imports per unitat han de ser positius.";
    if (t.maxUnits !== null && t.maxUnits <= t.minUnits)
      return "El màxim d'un tram ha de ser més gran que el seu mínim.";

    const next = ordered[i + 1];
    if (!next) {
      // L'últim és l'únic que pot quedar obert; si té sostre, el bonus deixa
      // de comptar a partir d'aquell punt, i això ha de ser una decisió
      // conscient, no un descuit.
      continue;
    }
    if (t.maxUnits === null)
      return "Només l'últim tram pot quedar sense límit superior.";
    if (t.maxUnits !== next.minUnits)
      return `Els trams han d'encadenar-se sense forats: un acaba a ${t.maxUnits} i el següent comença a ${next.minUnits}.`;
  }

  return null;
}

// ─── Pesos ──────────────────────────────────────────────────────────────────

export async function listWeights(): Promise<BonusWeight[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore().bonus_service_weights.map((w) => ({
      id: w.id,
      serviceType: w.service_type,
      weight: Number(w.weight),
      effectiveFrom: w.effective_from,
      effectiveUntil: w.effective_until,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonus_service_weights")
    .select("id, service_type, weight, effective_from, effective_until")
    .order("effective_from", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((w) => ({
    id: w.id,
    serviceType: w.service_type,
    weight: Number(w.weight),
    effectiveFrom: w.effective_from,
    effectiveUntil: w.effective_until,
  }));
}

/** Pesos vigents avui, per servei. */
export async function currentWeightMap(): Promise<Map<ServiceType, BonusWeight>> {
  const all = await listWeights();
  const today = todayStr();
  const map = new Map<ServiceType, BonusWeight>();
  for (const st of SERVICE_TYPES) {
    const w = weightOn(all, st, today);
    if (w) map.set(st, w);
  }
  return map;
}

/** Mateix criteri que setRate: tanca la vigent a ahir i n'insereix una de nova. */
export async function setWeight(
  serviceType: ServiceType,
  weight: number,
): Promise<void> {
  const today = todayStr();
  const yesterday = shiftDay(today, -1);
  const current = weightOn(await listWeights(), serviceType, today);

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    if (current) {
      if (current.effectiveFrom >= today) {
        store.bonus_service_weights = store.bonus_service_weights.filter(
          (w) => w.id !== current.id,
        );
      } else {
        const row = store.bonus_service_weights.find((w) => w.id === current.id);
        if (row) row.effective_until = yesterday;
      }
    }
    store.bonus_service_weights.push({
      id: crypto.randomUUID(),
      service_type: serviceType,
      weight,
      effective_from: today,
      effective_until: null,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  if (current) {
    const q =
      current.effectiveFrom >= today
        ? admin.from("bonus_service_weights").delete().eq("id", current.id)
        : admin
            .from("bonus_service_weights")
            .update({ effective_until: yesterday })
            .eq("id", current.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
  }

  const { error } = await admin.from("bonus_service_weights").insert({
    service_type: serviceType,
    weight,
    effective_from: today,
    effective_until: null,
  });
  if (error) throw new Error(error.message);
}

// ─── Trams ──────────────────────────────────────────────────────────────────

/** Trams vigents el dia indicat (per defecte avui), ordenats. */
export async function listTiers(onDay?: string): Promise<BonusTier[]> {
  const day = onDay ?? todayStr();

  const rows = USE_MOCK
    ? (await import("@/lib/mock/store")).getStore().bonus_tiers
    : await (async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("bonus_tiers")
          .select("id, min_units, max_units, rate_per_unit, effective_from, effective_until");
        if (error) throw new Error(error.message);
        return data ?? [];
      })();

  const tiers: BonusTier[] = rows.map((t) => ({
    id: t.id,
    minUnits: Number(t.min_units),
    maxUnits: t.max_units === null ? null : Number(t.max_units),
    ratePerUnit: Number(t.rate_per_unit),
    effectiveFrom: t.effective_from,
    effectiveUntil: t.effective_until,
  }));

  return vigentOn(tiers, day).sort((a, b) => a.minUnits - b.minUnits);
}

/**
 * Substitueix el joc de trams sencer.
 *
 * Els trams es desen i s'apliquen com un conjunt: canviar-ne un afecta on
 * comença el següent, així que es tanca tot el joc vigent a ahir i s'insereix
 * el nou a partir d'avui. Com amb els pesos, si el joc vigent ja començava
 * avui s'esborra en comptes de tancar-lo.
 */
export async function saveTiers(
  tiers: { minUnits: number; maxUnits: number | null; ratePerUnit: number }[],
): Promise<void> {
  const problem = validateTiers(tiers);
  if (problem) throw new Error(problem);

  const today = todayStr();
  const yesterday = shiftDay(today, -1);
  const current = await listTiers();

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    for (const c of current) {
      if (c.effectiveFrom >= today) {
        store.bonus_tiers = store.bonus_tiers.filter((t) => t.id !== c.id);
      } else {
        const row = store.bonus_tiers.find((t) => t.id === c.id);
        if (row) row.effective_until = yesterday;
      }
    }
    for (const t of tiers) {
      store.bonus_tiers.push({
        id: crypto.randomUUID(),
        min_units: t.minUnits,
        max_units: t.maxUnits,
        rate_per_unit: t.ratePerUnit,
        effective_from: today,
        effective_until: null,
        created_at: new Date().toISOString(),
      });
    }
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const toDelete = current.filter((c) => c.effectiveFrom >= today).map((c) => c.id);
  const toClose = current.filter((c) => c.effectiveFrom < today).map((c) => c.id);

  if (toDelete.length > 0) {
    const { error } = await admin.from("bonus_tiers").delete().in("id", toDelete);
    if (error) throw new Error(error.message);
  }
  if (toClose.length > 0) {
    const { error } = await admin
      .from("bonus_tiers")
      .update({ effective_until: yesterday })
      .in("id", toClose);
    if (error) throw new Error(error.message);
  }

  const { error } = await admin.from("bonus_tiers").insert(
    tiers.map((t) => ({
      min_units: t.minUnits,
      max_units: t.maxUnits,
      rate_per_unit: t.ratePerUnit,
      effective_from: today,
      effective_until: null,
    })),
  );
  if (error) throw new Error(error.message);
}

// ─── Configuració per treballador ───────────────────────────────────────────

export async function listWorkerSettings(): Promise<WorkerBonusSettings[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore().bonus_worker_settings.map((w) => ({
      trainerId: w.trainer_id,
      payoutFrequency: w.payout_frequency,
      enabled: w.enabled,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonus_worker_settings")
    .select("trainer_id, payout_frequency, enabled");
  if (error) throw new Error(error.message);
  return (data ?? []).map((w) => ({
    trainerId: w.trainer_id,
    payoutFrequency: w.payout_frequency,
    enabled: w.enabled,
  }));
}

/** Configuració d'un professional. `null` si mai s'ha configurat. */
export async function getWorkerSettings(
  trainerId: string,
): Promise<WorkerBonusSettings | null> {
  const all = await listWorkerSettings();
  return all.find((w) => w.trainerId === trainerId) ?? null;
}

export async function setWorkerSettings(
  trainerId: string,
  enabled: boolean,
  payoutFrequency: BonusPayoutFrequency,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const row = store.bonus_worker_settings.find((w) => w.trainer_id === trainerId);
    if (row) {
      row.enabled = enabled;
      row.payout_frequency = payoutFrequency;
      row.updated_at = new Date().toISOString();
    } else {
      store.bonus_worker_settings.push({
        trainer_id: trainerId,
        payout_frequency: payoutFrequency,
        enabled,
        updated_at: new Date().toISOString(),
      });
    }
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("bonus_worker_settings").upsert({
    trainer_id: trainerId,
    payout_frequency: payoutFrequency,
    enabled,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// ─── Càlcul ─────────────────────────────────────────────────────────────────

async function completedSessions(
  trainerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ day: string; serviceType: ServiceType }[]> {
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
 * Estat del bonus d'un professional en un període.
 *
 * Les unitats es calculen amb el pes vigent el DIA de cada sessió (històric
 * protegit, com les tarifes). Els trams, en canvi, s'apliquen sobre el total
 * acumulat: un tram no és una propietat de cada sessió sinó del volum del
 * període, i el volum només es coneix al final.
 *
 * Quins trams: els vigents al FINAL del període que es tanca. Per a un període
 * ja passat això vol dir els que hi havia aleshores, no els d'avui — el que
 * es liquida no pot dependre de quan es prem el botó. Per a un període encara
 * en curs el final és futur, així que es fan servir els d'avui.
 */
export async function computeBonus(
  trainerId: string,
  period: BonusPeriod,
  frequency: BonusPayoutFrequency,
): Promise<BonusProgress> {
  const today = todayStr();
  const tiersDay = period.end < today ? period.end : today;

  const [sessions, weights, tiers] = await Promise.all([
    completedSessions(trainerId, period.start, period.end),
    listWeights(),
    listTiers(tiersDay),
  ]);

  const acc = new Map<ServiceType, { sessions: number; units: number }>();
  let unweightedSessions = 0;

  for (const s of sessions) {
    const w = weightOn(weights, s.serviceType, s.day);
    if (!w) {
      unweightedSessions++;
      continue;
    }
    const e = acc.get(s.serviceType) ?? { sessions: 0, units: 0 };
    e.sessions += 1;
    e.units += w.weight;
    acc.set(s.serviceType, e);
  }

  const perService = SERVICE_TYPES.filter((st) => acc.has(st)).map((st) => ({
    serviceType: st,
    sessions: acc.get(st)!.sessions,
    units: round2(acc.get(st)!.units),
  }));

  const totalUnits = round2(perService.reduce((s, p) => s + p.units, 0));
  const { lines, total } = applyTiers(totalUnits, tiers);

  // Tram on cauria la unitat següent.
  const currentTier =
    tiers.find(
      (t) => totalUnits >= t.minUnits && (t.maxUnits === null || totalUnits < t.maxUnits),
    ) ?? null;
  const unitsToNextTier =
    currentTier && currentTier.maxUnits !== null
      ? round2(currentTier.maxUnits - totalUnits)
      : null;

  return {
    trainerId,
    period,
    frequency,
    perService,
    totalUnits,
    lines,
    totalAmount: total,
    currentTier,
    unitsToNextTier,
    unweightedSessions,
  };
}

/** Estat del període en curs d'un professional, segons la seva freqüència. */
export async function computeCurrentBonus(
  trainerId: string,
): Promise<{ settings: WorkerBonusSettings; progress: BonusProgress } | null> {
  const settings = await getWorkerSettings(trainerId);
  if (!settings || !settings.enabled) return null;
  const period = periodFor(settings.payoutFrequency);
  return {
    settings,
    progress: await computeBonus(trainerId, period, settings.payoutFrequency),
  };
}

// ─── Payouts ────────────────────────────────────────────────────────────────

export async function listPayouts(trainerId?: string): Promise<BonusPayout[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore()
      .bonus_payouts.filter((p) => !trainerId || p.trainer_id === trainerId)
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
      .map((p) => ({
        id: p.id,
        trainerId: p.trainer_id,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        totalUnits: Number(p.total_units),
        totalAmount: Number(p.total_amount),
        tierBreakdown: p.tier_breakdown,
        generatedAt: p.generated_at,
        generatedBy: p.generated_by,
      }));
  }

  const supabase = await createClient();
  let query = supabase
    .from("bonus_payouts")
    .select(
      "id, trainer_id, period_start, period_end, total_units, total_amount, tier_breakdown, generated_at, generated_by",
    )
    .order("generated_at", { ascending: false });
  if (trainerId) query = query.eq("trainer_id", trainerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    trainerId: p.trainer_id,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    totalUnits: Number(p.total_units),
    totalAmount: Number(p.total_amount),
    tierBreakdown: (p.tier_breakdown ?? []) as BonusTierLine[],
    generatedAt: p.generated_at,
    generatedBy: p.generated_by,
  }));
}

/** Payout ja existent per a aquest professional i període, si n'hi ha. */
export async function findPayout(
  trainerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<BonusPayout | null> {
  const all = await listPayouts(trainerId);
  return (
    all.find((p) => p.periodStart === periodStart && p.periodEnd === periodEnd) ??
    null
  );
}

/** Congela el càlcul d'un període. A partir d'aquí no depèn de pesos ni trams. */
export async function createPayout(
  progress: BonusProgress,
  generatedBy: string | null,
): Promise<string> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    // El mock ha de fer complir el mateix UNIQUE que la base de dades.
    const dup = store.bonus_payouts.some(
      (p) =>
        p.trainer_id === progress.trainerId &&
        p.period_start === progress.period.start &&
        p.period_end === progress.period.end,
    );
    if (dup) throw new Error("DUPLICATE_PAYOUT");
    const id = crypto.randomUUID();
    store.bonus_payouts.push({
      id,
      trainer_id: progress.trainerId,
      period_start: progress.period.start,
      period_end: progress.period.end,
      total_units: progress.totalUnits,
      total_amount: progress.totalAmount,
      tier_breakdown: progress.lines,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
    });
    saveStore(store);
    return id;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bonus_payouts")
    .insert({
      trainer_id: progress.trainerId,
      period_start: progress.period.start,
      period_end: progress.period.end,
      total_units: progress.totalUnits,
      total_amount: progress.totalAmount,
      tier_breakdown: progress.lines,
      generated_by: generatedBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}
