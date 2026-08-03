import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/mock/store";
import { getCenterSettings } from "@/lib/data/center-settings";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { listAllBlocksLite } from "@/lib/data/availability-blocks";
import {
  availableHoursOn,
  weekdayOfDay,
  isInstantBlocked,
  blocksOf,
  type TrainerRuleLite,
  type TrainerBlockLite,
} from "@/lib/availability-slots";
import {
  toCenterLocal,
  centerDateStr,
  centerHour,
  centerLocalToInstant,
} from "@/lib/center-time";
import type { ServiceType, TrialStatus } from "@/types/database";

// ─────────────────────── Tipus de sortida ───────────────────────

export type LowBono = {
  bonoId: string;
  clientId: string;
  clientName: string;
  serviceType: ServiceType;
  remaining: number;
};

export type TrainerOccupancy = {
  trainerId: string;
  trainerName: string;
  slots: number;
  booked: number;
  pct: number;
};

export type AdminDashboard = {
  revenue: {
    current: number;
    previous: number;
    /** Variació en % vs el mes anterior; null si el mes anterior va ser 0. */
    changePct: number | null;
    previousMonthLabel: string;
  };
  pendingBonos: { total: number; count: number };
  lowBonos: LowBono[];
  sessions: { today: number; week: number };
  occupancy: {
    slots: number;
    booked: number;
    pct: number;
    perTrainer: TrainerOccupancy[];
  };
  trialConversion: { converted: number; total: number; pct: number | null };
};

// ─────────────────────── Dades crues ───────────────────────
// Es normalitzen mock i real a la mateixa forma perquè el CÀLCUL sigui únic.

type RawPayment = { amount: number; paidAt: string };
type RawBono = {
  id: string;
  clientId: string;
  price: number;
  status: string;
  remaining: number;
  serviceType: ServiceType;
};
type RawReservation = {
  trainerId: string | null;
  scheduledAt: string;
  status: string;
};
type RawTrial = { status: TrialStatus; convertedClientId: string | null };

type Raw = {
  payments: RawPayment[];
  bonos: RawBono[];
  reservations: RawReservation[];
  trials: RawTrial[];
  clientNames: Map<string, string>;
  trainerNames: Map<string, string>;
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
};

const MONTHS = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

/** Comptabilitza una reserva com a sessió feta o compromesa. */
const COUNTS_AS_SESSION = (status: string) =>
  status === "booked" || status === "completed";

/** Proves que realment van arribar a fer-se (base de la conversió). */
const TRIAL_HAPPENED = (status: TrialStatus) =>
  status === "confirmed" || status === "completed";

async function gather(): Promise<Raw> {
  if (USE_MOCK) {
    const [rules, blocks] = await Promise.all([
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
    ]);
    const store = getStore();
    const clientNames = new Map<string, string>();
    for (const c of store.clients) {
      const p = store.profiles.find((x) => x.id === c.profile_id);
      clientNames.set(c.id, p?.full_name ?? "—");
    }
    const trainerNames = new Map<string, string>();
    for (const p of store.profiles.filter((x) => x.role === "trainer"))
      trainerNames.set(p.id, p.full_name ?? "—");

    return {
      payments: store.payments.map((p) => ({
        amount: p.amount,
        paidAt: p.paid_at,
      })),
      bonos: store.bonos.map((b) => ({
        id: b.id,
        clientId: b.client_id,
        price: b.price,
        status: b.status,
        remaining: b.remaining_sessions,
        serviceType: b.service_type,
      })),
      reservations: store.reservations.map((r) => ({
        trainerId: r.trainer_id,
        scheduledAt: r.scheduled_at,
        status: r.status,
      })),
      trials: store.trial_bookings.map((t) => ({
        status: t.status,
        convertedClientId: t.converted_client_id,
      })),
      clientNames,
      trainerNames,
      rules,
      blocks,
    };
  }

  // Client amb sessió (no service_role): la RLS d'admin ja permet llegir-ho
  // tot, i així la pàgina no depèn només del middleware per protegir-se.
  // Només construeix el client (llegeix cookies): no és cap viatge de xarxa.
  const admin = await createClient();

  // Les VUIT consultes són independents entre si, així que van totes alhora.
  // Abans les regles i els bloquejos s'esperaven a part, i les altres sis no
  // arrencaven fins que aquelles dues havien tornat: un viatge de xarxa de més.
  const [rules, blocks, pay, bon, res, tri, cli, tra] = await Promise.all([
    listAllTrainerRulesLite(),
    listAllBlocksLite(),
    admin.from("payments").select("amount, paid_at"),
    admin.from("bonos").select("id, client_id, price, status, remaining_sessions, service_type"),
    admin.from("reservations").select("trainer_id, scheduled_at, status"),
    admin.from("trial_bookings").select("status, converted_client_id"),
    admin
      .from("clients")
      .select("id, profile:profiles!clients_profile_id_fkey(full_name)"),
    admin.from("profiles").select("id, full_name").eq("role", "trainer"),
  ]);

  const clientNames = new Map<string, string>();
  for (const c of (cli.data ?? []) as unknown as Array<{
    id: string;
    profile: { full_name: string | null } | null;
  }>)
    clientNames.set(c.id, c.profile?.full_name ?? "—");

  const trainerNames = new Map<string, string>();
  for (const t of tra.data ?? []) trainerNames.set(t.id, t.full_name ?? "—");

  return {
    payments: (pay.data ?? []).map((p) => ({
      amount: p.amount,
      paidAt: p.paid_at,
    })),
    bonos: (bon.data ?? []).map((b) => ({
      id: b.id,
      clientId: b.client_id,
      price: b.price,
      status: b.status,
      remaining: b.remaining_sessions,
      serviceType: b.service_type,
    })),
    reservations: (res.data ?? []).map((r) => ({
      trainerId: r.trainer_id,
      scheduledAt: r.scheduled_at,
      status: r.status,
    })),
    trials: (tri.data ?? []).map((t) => ({
      status: t.status,
      convertedClientId: t.converted_client_id,
    })),
    clientNames,
    trainerNames,
    rules,
    blocks,
  };
}

// ─────────────────────── Càlcul ───────────────────────

/** Dies (YYYY-MM-DD, hora del centre) de la setmana en curs, de dilluns a diumenge. */
function currentWeekDays(now: Date): string[] {
  const local = toCenterLocal(now);
  const weekday = (local.getUTCDay() + 6) % 7; // 0 = dilluns
  const monday = new Date(local);
  monday.setUTCDate(monday.getUTCDate() - weekday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  });
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  // Les dades i la configuració són independents: van alhora.
  const [raw, settings] = await Promise.all([gather(), getCenterSettings()]);
  const now = new Date();

  // ── 1. Ingressos del mes (pagaments reals, mai bonos pendents) ──
  const localNow = toCenterLocal(now);
  const y = localNow.getUTCFullYear();
  const m = localNow.getUTCMonth();
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  const monthKey = (d: Date) => {
    const l = toCenterLocal(d);
    return `${l.getUTCFullYear()}-${l.getUTCMonth()}`;
  };
  const curKey = `${y}-${m}`;
  const prvKey = `${prevY}-${prevM}`;

  let current = 0;
  let previous = 0;
  for (const p of raw.payments) {
    const k = monthKey(new Date(p.paidAt));
    if (k === curKey) current += p.amount;
    else if (k === prvKey) previous += p.amount;
  }
  const changePct =
    previous > 0 ? ((current - previous) / previous) * 100 : null;

  // ── 2. Bonos pendents de cobrament ──
  const pending = raw.bonos.filter((b) => b.status === "pending_payment");
  const pendingBonos = {
    total: pending.reduce((s, b) => s + b.price, 0),
    count: pending.length,
  };

  // ── 3. Bonos a punt d'esgotar-se ──
  // Mateix criteri que l'avís bono_low (1 sessió). S'inclou el 0 per si algun
  // bo hagués quedat actiu sense sessions.
  // Llindar configurable per l'admin (abans era fix a 1).
  const lowBonos: LowBono[] = raw.bonos
    .filter((b) => b.status === "active" && b.remaining <= settings.bonoLowThreshold)
    .map((b) => ({
      bonoId: b.id,
      clientId: b.clientId,
      clientName: raw.clientNames.get(b.clientId) ?? "—",
      serviceType: b.serviceType,
      remaining: b.remaining,
    }))
    .sort((a, b) => a.remaining - b.remaining || a.clientName.localeCompare(b.clientName));

  // ── 4. Sessions d'avui / aquesta setmana ──
  const todayStr = centerDateStr(now);
  const weekDays = currentWeekDays(now);
  const weekSet = new Set(weekDays);

  let today = 0;
  let week = 0;
  for (const r of raw.reservations) {
    if (!COUNTS_AS_SESSION(r.status)) continue;
    const day = centerDateStr(new Date(r.scheduledAt));
    if (day === todayStr) today++;
    if (weekSet.has(day)) week++;
  }

  // ── 5. Ocupació de franges de la setmana ──
  // Slots = hores amb regla activa, menys les tapades per un bloqueig.
  const trainerIds = [...new Set(raw.rules.map((r) => r.trainerId))];
  const bookedKeys = new Set<string>();
  for (const r of raw.reservations) {
    if (!COUNTS_AS_SESSION(r.status) || !r.trainerId) continue;
    const d = new Date(r.scheduledAt);
    bookedKeys.add(`${r.trainerId}|${centerDateStr(d)}|${centerHour(d)}`);
  }

  const perTrainer: TrainerOccupancy[] = [];
  let slotsTotal = 0;
  let bookedTotal = 0;

  for (const trainerId of trainerIds) {
    const rules = raw.rules.filter((r) => r.trainerId === trainerId);
    const blocks = blocksOf(raw.blocks, trainerId);
    let slots = 0;
    let booked = 0;

    for (const day of weekDays) {
      // Sense Date pel mig: el dia i el dia de la setmana van explícits, que és
      // l'única manera que no depengui de la zona horària del procés.
      for (const h of availableHoursOn(rules, day, weekdayOfDay(day))) {
        // El bloqueig és un instant real: cal l'hora del centre convertida.
        const slotInstant = centerLocalToInstant(day, `${String(h).padStart(2, "0")}:00`);
        if (isInstantBlocked(blocks, slotInstant)) continue;
        slots++;
        if (bookedKeys.has(`${trainerId}|${day}|${h}`)) booked++;
      }
    }

    slotsTotal += slots;
    bookedTotal += booked;
    perTrainer.push({
      trainerId,
      trainerName: raw.trainerNames.get(trainerId) ?? "—",
      slots,
      booked,
      pct: slots > 0 ? (booked / slots) * 100 : 0,
    });
  }

  perTrainer.sort((a, b) => b.pct - a.pct);

  // ── 6. Conversió de sessions de prova ──
  const happened = raw.trials.filter((t) => TRIAL_HAPPENED(t.status));
  const converted = happened.filter((t) => t.convertedClientId).length;

  return {
    revenue: {
      current,
      previous,
      changePct,
      previousMonthLabel: MONTHS[prevM],
    },
    pendingBonos,
    lowBonos,
    sessions: { today, week },
    occupancy: {
      slots: slotsTotal,
      booked: bookedTotal,
      pct: slotsTotal > 0 ? (bookedTotal / slotsTotal) * 100 : 0,
      perTrainer,
    },
    trialConversion: {
      converted,
      total: happened.length,
      pct: happened.length > 0 ? (converted / happened.length) * 100 : null,
    },
  };
}
