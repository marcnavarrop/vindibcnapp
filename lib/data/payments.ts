import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { SERVICE_LABELS } from "@/lib/labels";
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
  paidAt: string;
};

function clientName(clientId: string | null, store: Store): string {
  if (!clientId) return "—";
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

export async function listPayments(): Promise<PaymentListItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.payments
      .slice()
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
      .map((p) => ({
        id: p.id,
        clientName: clientName(p.client_id, store),
        amount: p.amount,
        method: p.method,
        paidAt: p.paid_at,
      }));
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `id, amount, method, paid_at,
       client:clients!payments_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .order("paid_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    amount: number;
    method: PaymentMethod;
    paid_at: string;
    client: { profile: { full_name: string | null } | null } | null;
  };
  return (data as unknown as Row[]).map((p) => ({
    id: p.id,
    clientName: p.client?.profile?.full_name ?? "—",
    amount: p.amount,
    method: p.method,
    paidAt: p.paid_at,
  }));
}

export type PaymentInput = {
  clientId: string;
  bonoId: string | null;
  amount: number;
  method: PaymentMethod;
  /** Concepte comptable (p. ex. "Bo de 8 sessions · EP Individual"). */
  concept?: string | null;
};

/** Registra un cobro (efectivo o tarjeta). No procesa el pago: solo lo anota. */
export async function createPayment(input: PaymentInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.payments.push({
      id,
      client_id: input.clientId,
      bono_id: input.bonoId,
      stripe_payment_id: null,
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      client_id: input.clientId,
      bono_id: input.bonoId,
      amount: input.amount,
      method: input.method,
      concept: input.concept ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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
