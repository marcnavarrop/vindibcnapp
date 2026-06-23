import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { createPayment } from "@/lib/data/payments";
import type { ServiceType, BonoStatus, PaymentMethod } from "@/types/database";

export type BonoListItem = {
  id: string;
  clientName: string;
  serviceType: ServiceType;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  status: BonoStatus;
};

function clientName(clientId: string, store: Store): string {
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

export async function listBonos(): Promise<BonoListItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.bonos.map((b) => ({
      id: b.id,
      clientName: clientName(b.client_id, store),
      serviceType: b.service_type,
      totalSessions: b.total_sessions,
      remainingSessions: b.remaining_sessions,
      price: b.price,
      status: b.status,
    }));
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonos")
    .select(
      `id, service_type, total_sessions, remaining_sessions, price, status,
       client:clients!bonos_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    service_type: ServiceType;
    total_sessions: number;
    remaining_sessions: number;
    price: number;
    status: BonoStatus;
    client: { profile: { full_name: string | null } | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    clientName: r.client?.profile?.full_name ?? "—",
    serviceType: r.service_type,
    totalSessions: r.total_sessions,
    remainingSessions: r.remaining_sessions,
    price: r.price,
    status: r.status,
  }));
}

export type BonoInput = {
  clientId: string;
  serviceType: ServiceType;
  totalSessions: number;
  price: number;
  /** Si se indica, registra el cobro del bono con este método. */
  paymentMethod?: PaymentMethod | null;
};

/** Crea un bono para un cliente (sesiones restantes = totales al comprarlo). */
export async function createBono(input: BonoInput): Promise<string> {
  let bonoId: string;

  if (USE_MOCK) {
    const store = getStore();
    bonoId = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id: bonoId,
      client_id: input.clientId,
      service_type: input.serviceType,
      total_sessions: input.totalSessions,
      remaining_sessions: input.totalSessions,
      price: input.price,
      status: "active",
      purchased_at: now,
      created_at: now,
    });
    saveStore(store);
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bonos")
      .insert({
        client_id: input.clientId,
        service_type: input.serviceType,
        total_sessions: input.totalSessions,
        remaining_sessions: input.totalSessions,
        price: input.price,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    bonoId = data.id;
  }

  // Registra el cobro del bono si se ha indicado un método de pago.
  if (input.paymentMethod) {
    await createPayment({
      clientId: input.clientId,
      bonoId,
      amount: input.price,
      method: input.paymentMethod,
    });
  }

  return bonoId;
}
