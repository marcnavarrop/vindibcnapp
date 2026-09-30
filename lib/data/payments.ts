import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { SERVICE_LABELS } from "@/lib/labels";
import { centerDateStr } from "@/lib/center-time";
import type { PaymentMethod, ServiceType } from "@/types/database";

/** Concepte comptable d'un pagament de bo (per a la retenció fiscal). */
export function bonoConcept(
  serviceType: ServiceType,
  totalSessions: number,
): string {
  return `Bo de ${totalSessions} ${totalSessions === 1 ? "sessió" : "sessions"} · ${SERVICE_LABELS[serviceType]}`;
}

export type PaymentListItem = {
  id: string;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  /** Tal com el torna Postgres (amb microsegons): el cursor el necessita exacte. */
  paidAt: string;
};

function clientName(clientId: string | null, store: Store): string {
  if (!clientId) return "—";
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

/** Pagaments per pàgina de la llista. */
export const PAYMENTS_PAGE_SIZE = 50;

export type PaymentsPage = {
  items: PaymentListItem[];
  /** Per demanar la pàgina següent; null quan ja no n'hi ha més. */
  nextCursor: string | null;
};

/**
 * El cursor és l'últim (paid_at, id) de la pàgina, opac per a la pantalla.
 *
 * NO es fa passar `paid_at` per un `Date`: Postgres el guarda amb microsegons
 * i `toISOString()` els talla a mil·lèsimes. Amb l'hora retallada, la
 * comparació del cursor saltaria o repetiria els pagaments d'aquell mateix
 * instant.
 */
function encodeCursor(item: PaymentListItem): string {
  return Buffer.from(JSON.stringify([item.paidAt, item.id])).toString("base64url");
}

// Tots dos van dins d'un filtre de PostgREST (`or=(...)`), i no hi ha de poder
// entrar ni una coma, ni un parèntesi ni una cometa. L'id: lletres, xifres i
// guions (un uuid a la base; "pay-1" a la simulació). L'hora: xifres, guions,
// dos punts, punt, T o espai, i la zona.
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ][\d:.]+(Z|[+-]\d{2}(:?\d{2})?)?$/;

function decodeCursor(cursor: string): { paidAt: string; id: string } | null {
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [paidAt, id] = v;
    if (typeof paidAt !== "string" || !TIMESTAMP.test(paidAt)) return null;
    if (typeof id !== "string" || !SAFE_ID.test(id)) return null;
    return { paidAt, id };
  } catch {
    return null;
  }
}

/**
 * Una pàgina de pagaments, del més recent al més antic.
 *
 * Abans es portaven TOTS i la base en tallava 1000 sense avisar. Ara van per
 * pàgines amb un cursor sobre (paid_at, id), que és l'índex de la 0095: la
 * pàgina 20 costa el mateix que la primera, i un pagament nou no fa repetir ni
 * saltar-ne cap com passaria amb un offset.
 */
export async function listPayments(
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<PaymentsPage> {
  const limit = Math.min(Math.max(opts.limit ?? PAYMENTS_PAGE_SIZE, 1), 200);
  const after = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (opts.cursor && !after) throw new Error("Cursor de pagaments no vàlid.");

  let rows: PaymentListItem[];
  if (USE_MOCK) {
    const store = getStore();
    rows = store.payments
      .slice()
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.id.localeCompare(a.id))
      .filter(
        (p) =>
          !after ||
          p.paid_at < after.paidAt ||
          (p.paid_at === after.paidAt && p.id < after.id),
      )
      .slice(0, limit + 1)
      .map((p) => ({
        id: p.id,
        clientName: clientName(p.client_id, store),
        amount: p.amount,
        method: p.method,
        paidAt: p.paid_at,
      }));
  } else {
    const supabase = await createClient();
    let query = supabase
      .from("payments")
      .select(
        `id, amount, method, paid_at,
         client:clients!payments_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
      )
      .order("paid_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    // (paid_at, id) < (cursor): més antic, o del mateix instant amb id menor.
    if (after)
      query = query.or(
        `paid_at.lt."${after.paidAt}",and(paid_at.eq."${after.paidAt}",id.lt.${after.id})`,
      );
    const { data, error } = await query;
    if (error) throw error;

    type Row = {
      id: string;
      amount: number;
      method: PaymentMethod;
      paid_at: string;
      client: { profile: { full_name: string | null } | null } | null;
    };
    rows = (data as unknown as Row[]).map((p) => ({
      id: p.id,
      clientName: p.client?.profile?.full_name ?? "—",
      amount: p.amount,
      method: p.method,
      paidAt: p.paid_at,
    }));
  }

  // Se'n demana una de més per saber si n'hi ha més sense un segon viatge.
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
  };
}

// ─── Totals (0095) ──────────────────────────────────────────────────────────

export type PaymentsSummary = {
  total: number;
  count: number;
  card: { total: number; count: number };
  cash: { total: number; count: number };
};

/**
 * Els totals de TOTS els pagaments, comptats per la base (`payments_summary`).
 *
 * Abans la pantalla sumava la llista, i el dia que la base en tallés 1000 el
 * total hauria deixat de ser el total. Va amb la sessió de qui mira: la funció
 * només respon a l'admin i a qualsevol altre li torna un error, no un zero.
 */
export async function getPaymentsSummary(): Promise<PaymentsSummary> {
  if (USE_MOCK) {
    const ps = getStore().payments;
    const of = (m?: PaymentMethod) => {
      const xs = m ? ps.filter((p) => p.method === m) : ps;
      return { total: round2(xs.reduce((s, p) => s + p.amount, 0)), count: xs.length };
    };
    const all = of();
    return { total: all.total, count: all.count, card: of("card"), cash: of("cash") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payments_summary", {});
  if (error) throw error;
  const r = data?.[0];
  if (!r) throw new Error("payments_summary no ha tornat cap fila.");
  return {
    total: Number(r.total),
    count: Number(r.n),
    card: { total: Number(r.card_total), count: Number(r.card_n) },
    cash: { total: Number(r.cash_total), count: Number(r.cash_n) },
  };
}

export type MonthRevenue = {
  /** L'1 del mes, "AAAA-MM-01", en hora del centre. */
  month: string;
  total: number;
  count: number;
};

/**
 * El total de cada mes natural (hora del centre), dels últims `months` mesos
 * amb el que corre inclòs, del més antic al més nou i amb els buits a zero
 * (`payments_by_month`, 0095). Inici en demana 2. Mateixa regla que
 * `getPaymentsSummary`: només l'admin, amb la seva sessió.
 */
export async function paymentsByMonth(months: number): Promise<MonthRevenue[]> {
  if (!Number.isInteger(months) || months < 1 || months > 36)
    throw new Error("Mesos fora de rang (1..36).");

  if (USE_MOCK) {
    const [y, m] = centerDateStr(new Date()).split("-").map(Number);
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
    const out = new Map(keys.map((k) => [k, { month: k, total: 0, count: 0 }]));
    for (const p of getStore().payments) {
      const k = `${centerDateStr(new Date(p.paid_at)).slice(0, 7)}-01`;
      const row = out.get(k);
      if (row) {
        row.total = round2(row.total + p.amount);
        row.count++;
      }
    }
    return [...out.values()];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payments_by_month", { p_months: months });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    month: String(r.month),
    total: Number(r.total),
    count: Number(r.n),
  }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PaymentInput = {
  clientId: string;
  bonoId: string | null;
  amount: number;
  method: PaymentMethod;
  /** Concepte comptable (p. ex. "Bo de 8 sessions · EP Individual"). */
  concept?: string | null;
  /** Referència del cobrament a Stripe, quan ve d'una targeta. */
  stripePaymentId?: string | null;
};

/** La fila, igual per als dos camins. */
function paymentRow(input: PaymentInput) {
  return {
    client_id: input.clientId,
    bono_id: input.bonoId,
    amount: input.amount,
    method: input.method,
    concept: input.concept ?? null,
    stripe_payment_id: input.stripePaymentId ?? null,
  };
}

/** Registra un cobro (efectivo o tarjeta). No procesa el pago: solo lo anota. */
export async function createPayment(input: PaymentInput): Promise<string> {
  if (USE_MOCK) return mockPayment(input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .insert(paymentRow(input))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * El mateix cobrament, però escrit amb la clau de servei.
 *
 * El fa servir el webhook de Stripe, que no té sessió de ningú: la RLS de
 * `payments` només deixa escriure els administradors, i allà no n'hi ha cap
 * —qui autentica la petició és la signatura de Stripe, no una cookie—. La
 * separació és deliberada: els camins amb sessió segueixen passant per la RLS
 * i només aquest, que ja no en té, se la salta.
 */
export async function createSystemPayment(
  input: PaymentInput,
): Promise<string | null> {
  if (USE_MOCK) {
    const store = getStore();
    if (
      input.stripePaymentId &&
      store.payments.some((p) => p.stripe_payment_id === input.stripePaymentId)
    )
      return null;
    return mockPayment(input);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .insert(paymentRow(input))
    .select("id")
    .single();
  // 23505 amb l'índex de la 0054: aquest cobrament ja estava anotat. Passa quan
  // Stripe reintenta un compliment que va quedar a mitges, i és exactament el
  // que ha de passar: torna null i qui crida segueix amb la resta de passos.
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data.id;
}

function mockPayment(input: PaymentInput): string {
  const store = getStore();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  store.payments.push({
    id,
    client_id: input.clientId,
    bono_id: input.bonoId,
    stripe_payment_id: input.stripePaymentId ?? null,
    amount: input.amount,
    currency: "eur",
    method: input.method,
    concept: input.concept ?? null,
    paid_at: now,
    created_at: now,
  });
  saveStore(store);
  return id;
}

export type PaymentFormData = {
  clients: {
    id: string;
    name: string;
    bonos: { id: string; serviceType: ServiceType; price: number }[];
  }[];
};

/** Clientes y sus bonos, para el alta manual de un pago. */
export async function getPaymentFormData(): Promise<PaymentFormData> {
  if (USE_MOCK) {
    const store = getStore();
    const clients = store.clients.map((c) => {
      const profile = store.profiles.find((p) => p.id === c.profile_id);
      return {
        id: c.id,
        name: profile?.full_name ?? "—",
        bonos: store.bonos
          .filter((b) => b.client_id === c.id)
          .map((b) => ({
            id: b.id,
            serviceType: b.service_type,
            price: b.price,
          })),
      };
    });
    return { clients };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, service_type, price)`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;

  type Row = {
    id: string;
    profile: { full_name: string | null } | null;
    bonos: { id: string; service_type: ServiceType; price: number }[];
  };
  const clients = (data as unknown as Row[]).map((c) => ({
    id: c.id,
    name: c.profile?.full_name ?? "—",
    bonos: c.bonos.map((b) => ({
      id: b.id,
      serviceType: b.service_type,
      price: b.price,
    })),
  }));
  return { clients };
}
