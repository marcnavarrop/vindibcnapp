import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { createPayment, createSystemPayment, bonoConcept } from "@/lib/data/payments";
import {
  maybeGenerateReferralRewards,
  applyReferralReward,
  applyReferralRewardIfPending,
  getPendingReferralReward,
} from "@/lib/data/referral";
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
      first_reservation_at: null,
      gift_voucher_id: null,
      stripe_checkout_session_id: null,
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
 * Preu i dades del paquet que compra un client, amb el descompte ja resolt.
 *
 * Viu en una sola funció a propòsit. La regla —el millor entre l'oferta del
 * catàleg i la recompensa de referit, mai les dues— la necessiten ara tres
 * camins: la compra per pagar al centre, la sessió de Stripe (que ha de cobrar
 * EXACTAMENT el mateix) i el webhook. Amb una còpia per camí, el dia que la
 * regla canviï el client veurà un preu a la pantalla i un altre a la targeta.
 */
export type BonoPurchaseQuote = {
  clientId: string;
  serviceType: ServiceType;
  totalSessions: number;
  packageName: string;
  /** Preu final, amb el millor descompte ja aplicat. */
  finalPrice: number;
  /** Recompensa de referit que justifica aquest preu, si s'ha fet servir. */
  referralRewardId: string | null;
};

export async function quoteBonoPurchase(input: {
  profileId: string;
  serviceId: string;
}): Promise<BonoPurchaseQuote> {
  const { getEffectivePrice } = await import("@/lib/data/promotions");

  // Fitxa del client i paquet del catàleg, segons el mode.
  let clientId: string;
  let service: {
    id: string;
    serviceType: ServiceType;
    name: string;
    price: number;
    defaultSessions: number;
    active: boolean;
  };

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("Client no trobat.");
    const row = store.services.find((x) => x.id === input.serviceId && x.active);
    if (!row) throw new Error("Servei no vàlid.");
    clientId = client.id;
    service = {
      id: row.id,
      serviceType: row.service_type,
      name: row.name,
      price: row.price,
      defaultSessions: row.default_sessions,
      active: row.active,
    };
  } else {
    const admin = createAdminClient();
    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("id")
      .eq("profile_id", input.profileId)
      .single();
    if (cErr || !client) throw new Error("Client no trobat.");

    const { data: row, error: sErr } = await admin
      .from("services")
      .select("service_type, price, default_sessions, active, name")
      .eq("id", input.serviceId)
      .single();
    if (sErr || !row || !row.active) throw new Error("Servei no vàlid.");

    clientId = client.id;
    service = {
      id: input.serviceId,
      serviceType: row.service_type,
      name: row.name,
      price: row.price,
      defaultSessions: row.default_sessions,
      active: row.active,
    };
  }

  // El millor descompte, i només un: l'oferta pública del catàleg o la
  // recompensa personal de referit. No es combinen.
  const ep = await getEffectivePrice(service);
  const promoDiscountPct =
    service.price > 0 ? ((service.price - ep.finalPrice) / service.price) * 100 : 0;

  const pendingReward = await getPendingReferralReward(input.profileId);
  const useReferral =
    pendingReward !== null && pendingReward.discountPercent > promoDiscountPct;

  const finalPrice = useReferral
    ? Math.round(service.price * (1 - pendingReward!.discountPercent / 100) * 100) / 100
    : ep.finalPrice;

  return {
    clientId,
    serviceType: service.serviceType,
    totalSessions: service.defaultSessions,
    packageName: service.name,
    finalPrice,
    referralRewardId: useReferral ? pendingReward!.id : null,
  };
}

/**
 * Crea un bono 'pending_payment' per al client (pagament al centre).
 * El preu i les sessions surten del catàleg via `quoteBonoPurchase`: el
 * navegador només diu quin paquet vol.
 */
export async function createPendingBono(input: {
  profileId: string;
  serviceId: string;
}): Promise<string> {
  // La caducitat es compta des de la COMPRA, no des del pagament: un bo
  // pendent de pagar ja té la seva data des del primer moment.
  const expiresAt = await expiryForNewBono();
  const quote = await quoteBonoPurchase(input);

  let id: string;
  if (USE_MOCK) {
    const store = getStore();
    id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id,
      client_id: quote.clientId,
      service_type: quote.serviceType,
      total_sessions: quote.totalSessions,
      remaining_sessions: quote.totalSessions,
      price: quote.finalPrice,
      expires_at: expiresAt,
      first_reservation_at: null,
      gift_voucher_id: null,
      stripe_checkout_session_id: null,
      status: "pending_payment",
      purchased_at: now,
      created_at: now,
    });
    saveStore(store);
  } else {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("bonos")
      .insert({
        client_id: quote.clientId,
        service_type: quote.serviceType,
        total_sessions: quote.totalSessions,
        remaining_sessions: quote.totalSessions,
        price: quote.finalPrice,
        status: "pending_payment",
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("No s'ha pogut crear el bo.");
    id = data.id;
  }

  if (quote.referralRewardId) await applyReferralReward(quote.referralRewardId, id);
  return id;
}

/**
 * Crea el bo d'una compra JA COBRADA amb targeta. El crida el webhook de
 * Stripe, mai el navegador.
 *
 * Neix 'active' i no passa per 'pending_payment': els diners ja hi són.
 *
 * Complir una compra són VÀRIES escriptures (el bo, el cobrament, la
 * recompensa de referit) i entre dues qualssevol es pot caure. Per això la
 * funció està feta per poder-se repetir sencera: si el bo ja hi era, no es crea
 * un segon —ho impedeix l'índex únic de la 0054, no cap comprovació d'aquí— i
 * els passos següents es tornen a intentar igualment, perquè cadascun sap
 * quedar-se quiet si ja estava fet. Així un reintent de Stripe acaba el que va
 * quedar a mitges en comptes de donar-ho tot per fet.
 */
export async function createPaidBono(input: {
  clientId: string;
  serviceType: ServiceType;
  totalSessions: number;
  /** El que Stripe ha cobrat, en euros. */
  price: number;
  stripeCheckoutSessionId: string;
  stripePaymentId: string | null;
  referralRewardId: string | null;
}): Promise<{ id: string; created: boolean }> {
  const expiresAt = await expiryForNewBono();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("bonos")
    .insert({
      client_id: input.clientId,
      service_type: input.serviceType,
      total_sessions: input.totalSessions,
      remaining_sessions: input.totalSessions,
      price: input.price,
      status: "active",
      expires_at: expiresAt,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
    })
    .select("id")
    .single();

  let bonoId: string;
  let created: boolean;

  if (error?.code === "23505") {
    // Aquesta sessió ja tenia bo. Es recupera per poder acabar la resta de
    // passos: no es dona la compra per closa només perquè el bo hi sigui.
    const existing = await getBonoByStripeSession(input.stripeCheckoutSessionId);
    if (!existing)
      throw new Error("El bo consta duplicat però no s'ha pogut recuperar.");
    bonoId = existing.id;
    created = false;
  } else if (error || !data) {
    throw new Error(`No s'ha pogut crear el bo: ${error?.message}`);
  } else {
    bonoId = data.id;
    created = true;
  }

  // Idempotent per l'índex de `stripe_payment_id` (0054): si ja estava anotat,
  // torna null i no passa res.
  await createSystemPayment({
    clientId: input.clientId,
    bonoId,
    amount: input.price,
    method: "card",
    concept: bonoConcept(input.serviceType, input.totalSessions),
    stripePaymentId: input.stripePaymentId,
  });

  // La recompensa de referit es consumeix ARA, no en obrir la sessió: si el
  // client abandona el pagament, el descompte segueix sent seu. Condicional
  // perquè entremig podria haver-la gastat en una altra compra —i perquè en un
  // reintent ja estarà gastada per nosaltres mateixos.
  if (input.referralRewardId)
    await applyReferralRewardIfPending(input.referralRewardId, bonoId);

  // Mateixa regla que en cobrar al centre: les recompenses de qui el va portar
  // es generen quan el pagament es confirma. És idempotent.
  await maybeGenerateReferralRewards(input.clientId);

  return { id: bonoId, created };
}

/**
 * El bo d'una sessió de Checkout, per a la pantalla de tornada de Stripe.
 * Torna null mentre el webhook no hagi passat: la pàgina ho ensenya com a
 * "confirmant el pagament" i no crea res pel seu compte.
 */
export async function getBonoByStripeSession(sessionId: string): Promise<{
  id: string;
  serviceType: ServiceType;
  totalSessions: number;
  price: number;
  clientId: string;
} | null> {
  if (USE_MOCK) {
    const b = getStore().bonos.find(
      (x) => x.stripe_checkout_session_id === sessionId,
    );
    return b
      ? {
          id: b.id,
          serviceType: b.service_type,
          totalSessions: b.total_sessions,
          price: b.price,
          clientId: b.client_id,
        }
      : null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bonos")
    .select("id, service_type, total_sessions, price, client_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        serviceType: data.service_type,
        totalSessions: data.total_sessions,
        price: Number(data.price),
        clientId: data.client_id,
      }
    : null;
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
