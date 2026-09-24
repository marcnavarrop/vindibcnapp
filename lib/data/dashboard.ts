import "server-only";
import { SESSION_DURATION_MINUTES } from "@/lib/labels";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/mock/store";
import { getCenterSettings } from "@/lib/data/center-settings";
import {
  listAllTrainerRulesLite,
  listAvailabilityLite,
} from "@/lib/data/availability";
import {
  listAllBlocksLite,
  listBlocksLite,
} from "@/lib/data/availability-blocks";
import { isBonoExpired } from "@/lib/data/bonos";
import {
  availableSlotsOn,
  slotsFor,
  slotToHHMM,
  weekdayOfDay,
  isInstantBlocked,
  blocksOf,
  type AvailabilityRuleLite,
  type AvailabilityBlockLite,
  type TrainerRuleLite,
  type TrainerBlockLite,
} from "@/lib/availability-slots";
import {
  toCenterLocal,
  centerDateStr,
  centerSlot,
  centerLocalToInstant,
  centerWeekStart,
  centerDayStart,
  addDaysStr,
} from "@/lib/center-time";
import { mockFails } from "@/lib/mock/faults";
import type { BonoStatus, ServiceType, TrialStatus } from "@/types/database";

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
  /**
   * Null quan el mòdul de sessions de prova està apagat.
   *
   * No és "zero proves": és que la pantalla d'on surt la xifra ja no existeix
   * —`/admin/prova` respon 404 amb el mòdul apagat—, així que la targeta no
   * s'ha de pintar. Va com a null i no com a booleà a part perquè el tipus
   * obligui a mirar-ho abans de llegir el percentatge.
   */
  trialConversion: { converted: number; total: number; pct: number | null } | null;
  /** Parts que no s'han pogut carregar: la targeta ho diu en comptes de posar-hi un zero. */
  failed: DashboardPart[];
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
  /** Null = no caduca. Cal per descartar els caducats dels bons baixos. */
  expiresAt: string | null;
};
type RawReservation = {
  trainerId: string | null;
  scheduledAt: string;
  status: string;
};
/** Proves fetes i, d'aquestes, convertides: dos recomptes, no files. */
type RawTrials = { happened: number; converted: number };

/**
 * Les parts del tauler, per dir QUINA ha fallat.
 *
 * Abans cada consulta feia `(res.data ?? [])` sense mirar l'error, i una
 * consulta que fallava donava zeros que semblaven certs: "0 € aquest mes".
 * Ara una part que falla es registra, arriba aquí, i la targeta ho diu.
 */
export type DashboardPart =
  | "revenue"
  | "pendingBonos"
  | "lowBonos"
  | "sessions"
  | "occupancy"
  | "trials"
  | "clients";

type Raw = {
  payments: RawPayment[];
  bonos: RawBono[];
  reservations: RawReservation[];
  trials: RawTrials;
  clientNames: Map<string, string>;
  trainerNames: Map<string, string>;
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
  failed: Set<DashboardPart>;
};

const MONTHS = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

/** Comptabilitza una reserva com a sessió feta o compromesa. */
const COUNTS_AS_SESSION = (status: string) =>
  status === "booked" || status === "completed";

/** Proves que realment van arribar a fer-se (base de la conversió). */
const TRIAL_HAPPENED_STATUSES: TrialStatus[] = ["confirmed", "completed"];
const TRIAL_HAPPENED = (status: TrialStatus) =>
  TRIAL_HAPPENED_STATUSES.includes(status);

/**
 * La finestra que el tauler mira, en instants reals.
 *
 * - `monthsFrom`: l'1 del mes ANTERIOR, per als ingressos (aquest mes i el
 *   passat, per comparar).
 * - `weekFrom`/`weekTo`: la setmana en curs, de dilluns a dilluns. "Avui" hi
 *   és a dins sempre.
 *
 * Abans es portava tot l'històric i es filtrava aquí; amb el tall de la base a
 * 1000 files, el tauler hauria acabat comptant una mostra qualsevol.
 */
function dashboardWindow(now: Date) {
  const today = centerDateStr(now);
  const monday = centerWeekStart(today);
  const [y, m] = today.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const monthsFrom = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
  return {
    monthsFrom: centerDayStart(monthsFrom),
    weekFrom: centerDayStart(monday),
    weekTo: centerDayStart(addDaysStr(monday, 7)),
  };
}

/** Registra l'error d'una part i la marca com a fallida. */
function noteFailure(
  failed: Set<DashboardPart>,
  parts: DashboardPart[],
  what: string,
  error: { message: string } | null | undefined,
): boolean {
  if (!error) return false;
  console.error(`[tauler] ${what}: ${error.message}`);
  for (const p of parts) failed.add(p);
  return true;
}

async function gather(lowThreshold: number): Promise<Raw> {
  const now = new Date();
  const win = dashboardWindow(now);
  const failed = new Set<DashboardPart>();

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

    // Mateixes finestres que la consulta real, perquè el mode demo digui el
    // mateix que diria la base.
    const monthsFrom = win.monthsFrom.toISOString();
    const weekFrom = win.weekFrom.toISOString();
    const weekTo = win.weekTo.toISOString();
    const fail = (part: string, parts: DashboardPart[]) =>
      mockFails(part) &&
      noteFailure(failed, parts, `${part} (simulat)`, { message: "error simulat" });

    const payments = fail("payments", ["revenue"])
      ? []
      : store.payments
          .filter((p) => p.paid_at >= monthsFrom)
          .map((p) => ({ amount: p.amount, paidAt: p.paid_at }));
    const toRaw = (b: (typeof store.bonos)[number]): RawBono => ({
      id: b.id,
      clientId: b.client_id,
      price: b.price,
      status: b.status,
      remaining: b.remaining_sessions,
      serviceType: b.service_type,
      expiresAt: b.expires_at,
    });
    const pending = fail("bonos", ["pendingBonos", "lowBonos"])
      ? []
      : store.bonos.filter((b) => b.status === "pending_payment").map(toRaw);
    const low = failed.has("lowBonos")
      ? []
      : store.bonos
          .filter((b) => b.status === "active" && b.remaining_sessions <= lowThreshold)
          .map(toRaw);
    const reservations = fail("reservations", ["sessions", "occupancy"])
      ? []
      : store.reservations
          .filter((r) => r.scheduled_at >= weekFrom && r.scheduled_at < weekTo)
          .map((r) => ({ trainerId: r.trainer_id, scheduledAt: r.scheduled_at, status: r.status }));
    const happened = store.trial_bookings.filter((t) => TRIAL_HAPPENED(t.status));
    const trials = fail("trials", ["trials"])
      ? { happened: 0, converted: 0 }
      : {
          happened: happened.length,
          converted: happened.filter((t) => t.converted_client_id).length,
        };

    return {
      payments,
      bonos: [...pending, ...low],
      reservations,
      trials,
      clientNames,
      trainerNames,
      rules,
      blocks,
      failed,
    };
  }

  // Client amb sessió (no service_role): la RLS d'admin ja permet llegir-ho
  // tot, i així la pàgina no depèn només del middleware per protegir-se.
  // Només construeix el client (llegeix cookies): no és cap viatge de xarxa.
  const admin = await createClient();

  // El nom del client ve DINS de la consulta de bons: només calen els dels
  // bons que surten a la targeta, i abans es portaven tots els clients del
  // centre per trobar-ne uns quants.
  const BONO_SELECT = `id, client_id, price, status, remaining_sessions, service_type, expires_at,
     client:clients!bonos_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`;

  // Totes independents: van alhora.
  const [rules, blocks, pay, pend, low, res, triHappened, triConverted, tra] =
    await Promise.all([
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
      admin.from("payments").select("amount, paid_at").gte("paid_at", win.monthsFrom.toISOString()),
      admin.from("bonos").select(BONO_SELECT).eq("status", "pending_payment"),
      admin
        .from("bonos")
        .select(BONO_SELECT)
        .eq("status", "active")
        .lte("remaining_sessions", lowThreshold),
      admin
        .from("reservations")
        .select("trainer_id, scheduled_at, status")
        .gte("scheduled_at", win.weekFrom.toISOString())
        .lt("scheduled_at", win.weekTo.toISOString()),
      admin
        .from("trial_bookings")
        .select("id", { count: "exact", head: true })
        .in("status", TRIAL_HAPPENED_STATUSES),
      admin
        .from("trial_bookings")
        .select("id", { count: "exact", head: true })
        .in("status", TRIAL_HAPPENED_STATUSES)
        .not("converted_client_id", "is", null),
      admin.from("profiles").select("id, full_name").eq("role", "trainer"),
    ]);

  noteFailure(failed, ["revenue"], "pagaments", pay.error);
  noteFailure(failed, ["pendingBonos"], "bons pendents", pend.error);
  noteFailure(failed, ["lowBonos"], "bons baixos", low.error);
  noteFailure(failed, ["sessions", "occupancy"], "reserves de la setmana", res.error);
  noteFailure(failed, ["trials"], "proves fetes", triHappened.error);
  noteFailure(failed, ["trials"], "proves convertides", triConverted.error);
  noteFailure(failed, ["occupancy"], "professionals", tra.error);

  type BonoRow = {
    id: string;
    client_id: string;
    price: number;
    status: BonoStatus;
    remaining_sessions: number;
    service_type: ServiceType;
    expires_at: string | null;
    client: { profile: { full_name: string | null } | null } | null;
  };
  const clientNames = new Map<string, string>();
  const bonos = [
    ...((pend.data ?? []) as unknown as BonoRow[]),
    ...((low.data ?? []) as unknown as BonoRow[]),
  ].map((b) => {
    clientNames.set(b.client_id, b.client?.profile?.full_name ?? "—");
    return {
      id: b.id,
      clientId: b.client_id,
      price: b.price,
      status: b.status,
      remaining: b.remaining_sessions,
      serviceType: b.service_type,
      expiresAt: b.expires_at,
    };
  });

  const trainerNames = new Map<string, string>();
  for (const t of tra.data ?? []) trainerNames.set(t.id, t.full_name ?? "—");

  return {
    payments: (pay.data ?? []).map((p) => ({
      amount: p.amount,
      paidAt: p.paid_at,
    })),
    bonos,
    reservations: (res.data ?? []).map((r) => ({
      trainerId: r.trainer_id,
      scheduledAt: r.scheduled_at,
      status: r.status,
    })),
    trials: {
      happened: triHappened.count ?? 0,
      converted: triConverted.count ?? 0,
    },
    clientNames,
    trainerNames,
    rules,
    blocks,
    failed,
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

/**
 * Ocupació d'un professional en uns dies concrets.
 *
 * Slots = hores amb regla activa, menys les tapades per un bloqueig. Qui crida
 * diu què compta com a reservat (`isBooked`) perquè el tauler d'admin fa la
 * cerca per professional dins d'un conjunt global i el del professional només
 * té les seves: el càlcul, que és el que ha de coincidir, és el mateix.
 */
function occupancyOf(
  rules: AvailabilityRuleLite[],
  blocks: AvailabilityBlockLite[],
  weekDays: string[],
  isBooked: (day: string, slot: number) => boolean,
): { slots: number; booked: number; pct: number } {
  let slots = 0;
  let booked = 0;

  for (const day of weekDays) {
    // Sense Date pel mig: el dia i el dia de la setmana van explícits, que és
    // l'única manera que no depengui de la zona horària del procés.
    //
    // Es compten els slots COBERTS per l'horari, no els inicis possibles: això
    // és capacitat. Abans es comptaven hores i ara mitges hores, o sigui que el
    // denominador es dobla — però el numerador també, perquè una reserva d'una
    // hora marca els dos slots que ocupa. La proporció no es mou.
    for (const slot of availableSlotsOn(rules, day, weekdayOfDay(day))) {
      // El bloqueig és un instant real: cal l'hora del centre convertida.
      const slotInstant = centerLocalToInstant(day, slotToHHMM(slot));
      if (isInstantBlocked(blocks, slotInstant)) continue;
      slots++;
      if (isBooked(day, slot)) booked++;
    }
  }

  return { slots, booked, pct: slots > 0 ? (booked / slots) * 100 : 0 };
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  // El llindar dels bons baixos va a la consulta: primer la configuració.
  const settings = await getCenterSettings();
  const raw = await gather(settings.bonoLowThreshold);
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
  // El bo caducat en queda fora: aquesta targeta és una llista de gent a qui
  // oferir renovació, i un bo que ja no es pot fer servir no hi porta. La data
  // mana sobre l'estat desat, perquè l'escombrat de caducitat és peresós i pot
  // no haver-hi passat encara.
  const lowBonos: LowBono[] = raw.bonos
    .filter(
      (b) =>
        b.status === "active" &&
        b.remaining <= settings.bonoLowThreshold &&
        !isBonoExpired({ status: b.status, expires_at: b.expiresAt }),
    )
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
  const trainerIds = [...new Set(raw.rules.map((r) => r.trainerId))];
  const bookedKeys = new Set<string>();
  for (const r of raw.reservations) {
    if (!COUNTS_AS_SESSION(r.status) || !r.trainerId) continue;
    const d = new Date(r.scheduledAt);
    // Tots els slots que ocupa, no només el d'inici: una sessió d'una hora
    // n'ocupa dos i ha de comptar com a dos contra el denominador.
    const from = centerSlot(d);
    for (let i = 0; i < slotsFor(SESSION_DURATION_MINUTES); i++)
      bookedKeys.add(`${r.trainerId}|${centerDateStr(d)}|${from + i}`);
  }

  const perTrainer: TrainerOccupancy[] = [];
  let slotsTotal = 0;
  let bookedTotal = 0;

  for (const trainerId of trainerIds) {
    const { slots, booked, pct } = occupancyOf(
      raw.rules.filter((r) => r.trainerId === trainerId),
      blocksOf(raw.blocks, trainerId),
      weekDays,
      (day, h) => bookedKeys.has(`${trainerId}|${day}|${h}`),
    );

    slotsTotal += slots;
    bookedTotal += booked;
    perTrainer.push({
      trainerId,
      trainerName: raw.trainerNames.get(trainerId) ?? "—",
      slots,
      booked,
      pct,
    });
  }

  perTrainer.sort((a, b) => b.pct - a.pct);

  // ── 6. Conversió de sessions de prova ──
  const { happened, converted } = raw.trials;

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
    // Amb el mòdul apagat no hi ha xifra: mateix criteri que les recompenses
    // de referit a `getAdminAttention`, que amb el programa aturat ni es
    // demanen. Una mètrica que enllaça a una pàgina que ja no existeix és
    // pitjor que no tenir-la.
    trialConversion: settings.modules.sessionsProva
      ? {
          converted,
          total: happened,
          pct: happened > 0 ? (converted / happened) * 100 : null,
        }
      : null,
    failed: [...raw.failed],
  };
}

// ═══════════════════ Tauler del professional ═══════════════════
// Les mateixes mètriques d'operativa que veu l'admin, però limitades a qui
// mira: ni ingressos ni pendents de cobrament, que són del negoci i no seus.

export type TrainerDashboard = {
  sessions: { today: number; week: number };
  clients: number;
  /** Bons dels SEUS clients assignats per sota del llindar del centre. */
  lowBonos: LowBono[];
  occupancy: { slots: number; booked: number; pct: number };
  /** Parts que no s'han pogut carregar (vegeu `DashboardPart`). */
  failed: DashboardPart[];
};

type RawTrainer = {
  reservations: { scheduledAt: string; status: string }[];
  bonos: RawBono[];
  clientNames: Map<string, string>;
  clientCount: number;
  rules: AvailabilityRuleLite[];
  blocks: AvailabilityBlockLite[];
  failed: Set<DashboardPart>;
};

/**
 * Dades del professional. Tot filtrat per ell a la consulta, no després:
 * la RLS li deixa llegir reserves i bons de tot el centre per coordinar-se,
 * així que si el filtre no és a la consulta, el tauler li ensenyaria números
 * dels companys sense que res ho impedeixi.
 *
 * I només el que es pinta: la seva setmana, els seus bons actius per sota del
 * llindar i el RECOMPTE dels seus clients. Abans eren tota la seva història,
 * tots els bons dels seus clients i la llista sencera dels clients per comptar-los.
 */
async function gatherTrainer(
  trainerId: string,
  lowThreshold: number,
): Promise<RawTrainer> {
  const win = dashboardWindow(new Date());
  const failed = new Set<DashboardPart>();

  if (USE_MOCK) {
    const [rules, blocks] = await Promise.all([
      listAvailabilityLite(trainerId),
      listBlocksLite(trainerId),
    ]);
    const store = getStore();
    const myClients = store.clients.filter(
      (c) => c.assigned_trainer_id === trainerId,
    );
    const myClientIds = new Set(myClients.map((c) => c.id));
    const clientNames = new Map<string, string>();
    for (const c of myClients) {
      const p = store.profiles.find((x) => x.id === c.profile_id);
      clientNames.set(c.id, p?.full_name ?? "—");
    }
    const weekFrom = win.weekFrom.toISOString();
    const weekTo = win.weekTo.toISOString();
    const fail = (part: string, parts: DashboardPart[]) =>
      mockFails(part) &&
      noteFailure(failed, parts, `${part} (simulat)`, { message: "error simulat" });

    return {
      reservations: fail("reservations", ["sessions", "occupancy"])
        ? []
        : store.reservations
            .filter(
              (r) =>
                r.trainer_id === trainerId &&
                r.scheduled_at >= weekFrom &&
                r.scheduled_at < weekTo,
            )
            .map((r) => ({ scheduledAt: r.scheduled_at, status: r.status })),
      bonos: fail("bonos", ["lowBonos"])
        ? []
        : store.bonos
            .filter(
              (b) =>
                myClientIds.has(b.client_id) &&
                b.status === "active" &&
                b.remaining_sessions <= lowThreshold,
            )
            .map((b) => ({
              id: b.id,
              clientId: b.client_id,
              price: b.price,
              status: b.status,
              remaining: b.remaining_sessions,
              serviceType: b.service_type,
              expiresAt: b.expires_at,
            })),
      clientNames,
      clientCount: fail("clients", ["clients"]) ? 0 : myClients.length,
      rules,
      blocks,
      failed,
    };
  }

  const supabase = await createClient();

  // Totes independents: van alhora.
  const [rules, blocks, res, bon, cli] = await Promise.all([
    listAvailabilityLite(trainerId),
    listBlocksLite(trainerId),
    supabase
      .from("reservations")
      .select("scheduled_at, status")
      .eq("trainer_id", trainerId)
      .gte("scheduled_at", win.weekFrom.toISOString())
      .lt("scheduled_at", win.weekTo.toISOString()),
    // !inner perquè el filtre és sobre el client, no sobre el bo: sense join
    // intern, PostgREST tornaria també els bons dels clients d'altres.
    supabase
      .from("bonos")
      .select(
        `id, client_id, price, status, remaining_sessions, service_type, expires_at,
         client:clients!inner(assigned_trainer_id,
           profile:profiles!clients_profile_id_fkey(full_name))`,
      )
      .eq("client.assigned_trainer_id", trainerId)
      .eq("status", "active")
      .lte("remaining_sessions", lowThreshold),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("assigned_trainer_id", trainerId),
  ]);

  noteFailure(failed, ["sessions", "occupancy"], "reserves de la setmana", res.error);
  noteFailure(failed, ["lowBonos"], "bons baixos", bon.error);
  noteFailure(failed, ["clients"], "clients assignats", cli.error);

  type BonoRow = {
    id: string;
    client_id: string;
    price: number;
    status: BonoStatus;
    remaining_sessions: number;
    service_type: ServiceType;
    expires_at: string | null;
    client: { profile: { full_name: string | null } | null } | null;
  };

  const clientNames = new Map<string, string>();
  const bonos = ((bon.data ?? []) as unknown as BonoRow[]).map((b) => {
    clientNames.set(b.client_id, b.client?.profile?.full_name ?? "—");
    return {
      id: b.id,
      clientId: b.client_id,
      price: b.price,
      status: b.status,
      remaining: b.remaining_sessions,
      serviceType: b.service_type,
      expiresAt: b.expires_at,
    };
  });

  return {
    reservations: (res.data ?? []).map((r) => ({
      scheduledAt: r.scheduled_at,
      status: r.status,
    })),
    bonos,
    clientNames,
    clientCount: cli.count ?? 0,
    rules,
    blocks,
    failed,
  };
}

export async function getTrainerDashboard(
  trainerId: string,
): Promise<TrainerDashboard> {
  // Sense sessió no hi ha res a comptar; evita una consulta amb un id buit.
  if (!trainerId)
    return {
      sessions: { today: 0, week: 0 },
      clients: 0,
      lowBonos: [],
      occupancy: { slots: 0, booked: 0, pct: 0 },
      failed: [],
    };

  /*
   * Les proves pendents ja no es demanen aquí.
   *
   * Eren una de les targetes, i sortien de `listTrialBookings`, que fa
   * l'escombrada peresosa de caducitats: obrir l'inici escrivia a la base.
   * Ara viuen a "Atenció immediata", que les llegeix amb una consulta pura.
   */
  // El llindar dels bons baixos va a la consulta: primer la configuració.
  const settings = await getCenterSettings();
  const raw = await gatherTrainer(trainerId, settings.bonoLowThreshold);
  const now = new Date();

  // ── Sessions d'avui / aquesta setmana ──
  const todayStr = centerDateStr(now);
  const weekDays = currentWeekDays(now);
  const weekSet = new Set(weekDays);

  let today = 0;
  let week = 0;
  const bookedKeys = new Set<string>();
  for (const r of raw.reservations) {
    if (!COUNTS_AS_SESSION(r.status)) continue;
    const d = new Date(r.scheduledAt);
    const day = centerDateStr(d);
    if (day === todayStr) today++;
    if (weekSet.has(day)) week++;
    // Mateix criteri que al tauler d'admin: tots els slots que ocupa.
    const from = centerSlot(d);
    for (let i = 0; i < slotsFor(SESSION_DURATION_MINUTES); i++)
      bookedKeys.add(`${day}|${from + i}`);
  }

  // ── Bons a punt d'esgotar-se ──
  // Mateix llindar que el tauler d'admin. A més es descarta el bo caducat:
  // aquí la data mana sobre l'estat desat, com a la resta de l'app, perquè
  // perseguir la renovació d'un bo que ja no es pot fer servir no té sentit.
  const lowBonos: LowBono[] = raw.bonos
    .filter(
      (b) =>
        b.status === "active" &&
        b.remaining <= settings.bonoLowThreshold &&
        !isBonoExpired({ status: b.status, expires_at: b.expiresAt }),
    )
    .map((b) => ({
      bonoId: b.id,
      clientId: b.clientId,
      clientName: raw.clientNames.get(b.clientId) ?? "—",
      serviceType: b.serviceType,
      remaining: b.remaining,
    }))
    .sort(
      (a, b) =>
        a.remaining - b.remaining || a.clientName.localeCompare(b.clientName),
    );

  // ── Ocupació de la seva disponibilitat aquesta setmana ──
  const occupancy = occupancyOf(raw.rules, raw.blocks, weekDays, (day, h) =>
    bookedKeys.has(`${day}|${h}`),
  );

  return {
    sessions: { today, week },
    clients: raw.clientCount,
    lowBonos,
    occupancy,
    failed: [...raw.failed],
  };
}
