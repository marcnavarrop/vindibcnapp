import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { createPayment, bonoConcept } from "@/lib/data/payments";
import { maybeGenerateReferralRewards, applyReferralReward, getPendingReferralReward } from "@/lib/data/referral";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerToday } from "@/lib/center-time";
import type { ServiceType, BonoStatus, PaymentMethod } from "@/types/database";

// ─── Caducitat ───────────────────────────────────────────────────────────────

/**
 * Data de caducitat d'un bo comprat ara, segons la configuració d'AQUEST
 * moment. Es desa al bo i no es torna a calcular mai: si demà el centre canvia
 * els mesos de validesa, els bons ja venuts conserven la seva data.
 */
export async function expiryForNewBono(): Promise<string | null> {
  const { bonoExpiryMonths } = await getCenterSettings();
  if (!bonoExpiryMonths || bonoExpiryMonths <= 0) return null;
  const [y, m, d] = centerToday().split("-").map(Number);
  // Dia 0 del mes següent = últim dia del mes: si el dia d'origen no existeix
  // al mes de destí (31 de gener + 1 mes), es queda a l'últim dia d'aquell mes
  // en comptes de saltar al mes següent.
  const total = m - 1 + bonoExpiryMonths;
  const ty = y + Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ty}-${pad(tm)}-${pad(day)}`;
}

/** Estats en què un bo encara compta com a utilitzable (si no ha caducat). */
const USABLE: BonoStatus[] = ["active", "pending_payment"];

/**
 * Un bo caducat és el que té data passada i encara consta com a utilitzable.
 * Es mira contra el dia del CENTRE: un bo caduca a la mitjanit d'aquí.
 */
export function isBonoExpired(
  b: { status: BonoStatus; expires_at: string | null },
  today: string = centerToday(),
): boolean {
  return (
    USABLE.includes(b.status) && b.expires_at !== null && b.expires_at < today
  );
}

/**
 * Marca com 'expired' els bons que ja ho estan.
 *
 * Peresós i oportunista, com les sessions de prova: no cal cap cron, n'hi ha
 * prou amb passar-hi cada cop que es consulten. Encara que aquesta passada no
 * hagi corregut, `isBonoExpired` ja els descarta a tot arreu, així que un bo
 * caducat no és utilitzable ni un instant abans que s'hi escrigui l'estat.
 */
export async function sweepExpiredBonos(): Promise<void> {
  const today = centerToday();

  if (USE_MOCK) {
    const store = getStore();
    let changed = false;
    for (const b of store.bonos)
      if (isBonoExpired(b, today)) {
        b.status = "expired";
        changed = true;
      }
    if (changed) saveStore(store);
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("bonos")
    .update({ status: "expired" })
    .in("status", USABLE)
    .not("expires_at", "is", null)
    .lt("expires_at", today);
}

export type BonoListItem = {
  id: string;
  clientName: string;
  serviceType: ServiceType;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  status: BonoStatus;
  /** Data de caducitat fixada en comprar-lo. Null = no caduca. */
  expiresAt: string | null;
};

function clientName(clientId: string, store: Store): string {
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

export async function listBonos(): Promise<BonoListItem[]> {
  await sweepExpiredBonos();

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
      expiresAt: b.expires_at ?? null,
    }));
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonos")
    .select(
      `id, service_type, total_sessions, remaining_sessions, price, status, expires_at,
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
    expires_at: string | null;
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
    expiresAt: r.expires_at,
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
  // Es calcula ARA i es desa: a partir d'aquí el bo ja no depèn de la config.
  const expiresAt = await expiryForNewBono();

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
      expires_at: expiresAt,
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
        expires_at: expiresAt,
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

/**
 * Crea un bono 'pending_payment' per al client.
 * Aplica automàticament el millor descompte entre:
 *   a) la promoció activa del catàleg (getEffectivePrice)
 *   b) un referral_reward pendent del client
 * No es combinen: s'aplica només el que dóna un % major.
 * Si s'aplica la recompensa de referit, queda marcada com a 'used'.
 */
export async function createPendingBono(input: {
  profileId: string;
  serviceId: string;
}): Promise<string> {
  // La caducitat es compta des de la COMPRA, no des del pagament: un bo
  // pendent de pagar ja té la seva data des del primer moment.
  const expiresAt = await expiryForNewBono();
  const { getEffectivePrice } = await import("@/lib/data/promotions");

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("Client no trobat.");
    const serviceRow = store.services.find(
      (s) => s.id === input.serviceId && s.active,
    );
    if (!serviceRow) throw new Error("Servei no vàlid.");
    const service = {
      id: serviceRow.id,
      serviceType: serviceRow.service_type,
      name: serviceRow.name,
      price: serviceRow.price,
      defaultSessions: serviceRow.default_sessions,
      active: serviceRow.active,
    };
    const ep = await getEffectivePrice(service);
    const promoDiscountPct = serviceRow.price > 0
      ? ((serviceRow.price - ep.finalPrice) / serviceRow.price) * 100
      : 0;

    const pendingReward = await getPendingReferralReward(input.profileId);
    const useReferral =
      pendingReward !== null &&
      pendingReward.discountPercent > promoDiscountPct;

    const finalPrice = useReferral
      ? Math.round(serviceRow.price * (1 - pendingReward!.discountPercent / 100) * 100) / 100
      : ep.finalPrice;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id,
      client_id: client.id,
      service_type: serviceRow.service_type,
      total_sessions: serviceRow.default_sessions,
      remaining_sessions: serviceRow.default_sessions,
      price: finalPrice,
      expires_at: expiresAt,
      status: "pending_payment",
      purchased_at: now,
      created_at: now,
    });
    saveStore(store);
    if (useReferral) await applyReferralReward(pendingReward!.id, id);
    return id;
  }

  const admin = createAdminClient();
  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", input.profileId)
    .single();
  if (cErr || !client) throw new Error("Client no trobat.");

  const { data: serviceRow, error: sErr } = await admin
    .from("services")
    .select("service_type, price, default_sessions, active, name")
    .eq("id", input.serviceId)
    .single();
  if (sErr || !serviceRow || !serviceRow.active)
    throw new Error("Servei no vàlid.");

  const service = {
    id: input.serviceId,
    serviceType: serviceRow.service_type,
    name: serviceRow.name,
    price: serviceRow.price,
    defaultSessions: serviceRow.default_sessions,
    active: serviceRow.active,
  };
  const ep = await getEffectivePrice(service);
  const promoDiscountPct = serviceRow.price > 0
    ? ((serviceRow.price - ep.finalPrice) / serviceRow.price) * 100
    : 0;

  const pendingReward = await getPendingReferralReward(input.profileId);
  const useReferral =
    pendingReward !== null &&
    pendingReward.discountPercent > promoDiscountPct;

  const finalPrice = useReferral
    ? Math.round(serviceRow.price * (1 - pendingReward!.discountPercent / 100) * 100) / 100
    : ep.finalPrice;

  const { data, error } = await admin
    .from("bonos")
    .insert({
      client_id: client.id,
      service_type: serviceRow.service_type,
      total_sessions: serviceRow.default_sessions,
      remaining_sessions: serviceRow.default_sessions,
      price: finalPrice,
      status: "pending_payment",
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No s'ha pogut crear el bo.");
  if (useReferral) await applyReferralReward(pendingReward!.id, data.id);
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
    // Genera les recompenses de referit només quan el pagament es confirma.
    // És idempotent: no duplica si ja existeixen per aquest referit.
    await maybeGenerateReferralRewards(bono.client_id);
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
  // Generate referral rewards if this is the first paid bono for this client
  // (maybeGenerateReferralRewards is idempotent — safe to call unconditionally)
  await maybeGenerateReferralRewards(bono.client_id);
}
