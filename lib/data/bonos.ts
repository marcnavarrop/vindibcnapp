import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { createPayment, bonoConcept } from "@/lib/data/payments";
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
      concept: bonoConcept(input.serviceType, input.totalSessions),
    });
  }

  return bonoId;
}

// ──────────── Compra del propio cliente (pendiente de pago) ────────────
//
// El cliente no tiene RLS de escritura sobre `bonos`. Igual que con las
// reservas, la validación de negocio vive en el servidor y la escritura usa
// service_role: el cliente solo envía el `serviceId`; el precio y las sesiones
// salen del catálogo, nunca del cliente.

/** Crea un bono 'pending_payment' para el propio cliente (a pagar en el centro). */
export async function createPendingBono(input: {
  profileId: string;
  serviceId: string;
}): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("Client no trobat.");
    const service = store.services.find(
      (s) => s.id === input.serviceId && s.active,
    );
    if (!service) throw new Error("Servei no vàlid.");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id,
      client_id: client.id,
      service_type: service.service_type,
      total_sessions: service.default_sessions,
      remaining_sessions: service.default_sessions,
      price: service.price,
      status: "pending_payment",
      purchased_at: now,
      created_at: now,
    });
    saveStore(store);
    return id;
  }

  const admin = createAdminClient();
  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", input.profileId)
    .single();
  if (cErr || !client) throw new Error("Client no trobat.");

  const { data: service, error: sErr } = await admin
    .from("services")
    .select("service_type, price, default_sessions, active")
    .eq("id", input.serviceId)
    .single();
  if (sErr || !service || !service.active)
    throw new Error("Servei no vàlid.");

  const { data, error } = await admin
    .from("bonos")
    .insert({
      client_id: client.id,
      service_type: service.service_type,
      total_sessions: service.default_sessions,
      remaining_sessions: service.default_sessions,
      price: service.price,
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No s'ha pogut crear el bo.");
  return data.id;
}

/**
 * Marca un bono pendiente como pagado: lo activa y registra el cobro en
 * efectivo (lo hace el admin cuando el cliente paga en el centro).
 */
export async function markBonoPaid(bonoId: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const bono = store.bonos.find((b) => b.id === bonoId);
    if (!bono) throw new Error("Bo no trobat.");
    if (bono.status !== "pending_payment")
      throw new Error("Aquest bo no està pendent de pagament.");
    bono.status = "active";
    saveStore(store);
    await createPayment({
      clientId: bono.client_id,
      bonoId: bono.id,
      amount: bono.price,
      method: "cash",
      concept: bonoConcept(bono.service_type, bono.total_sessions),
    });
    return;
  }

  const supabase = await createClient();
  const { data: bono, error: bErr } = await supabase
    .from("bonos")
    .select("id, client_id, price, status, service_type, total_sessions")
    .eq("id", bonoId)
    .single();
  if (bErr || !bono) throw new Error("Bo no trobat.");
  if (bono.status !== "pending_payment")
    throw new Error("Aquest bo no està pendent de pagament.");

  const { error: uErr } = await supabase
    .from("bonos")
    .update({ status: "active" })
    .eq("id", bonoId);
  if (uErr) throw uErr;

  await createPayment({
    clientId: bono.client_id,
    bonoId: bono.id,
    amount: bono.price,
    method: "cash",
    concept: bonoConcept(bono.service_type, bono.total_sessions),
  });
}
