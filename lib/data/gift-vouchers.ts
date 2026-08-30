import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getEffectivePrice } from "@/lib/data/promotions";
import { createPayment } from "@/lib/data/payments";
import { centerToday } from "@/lib/center-time";
import { SERVICE_LABELS } from "@/lib/labels";
import type { GiftVoucherStatus, ServiceType } from "@/types/database";

/**
 * Vals de regal.
 *
 * TOT passa pel client de SERVEI, també les lectures del comprador. No és per
 * comoditat: el canvi ha de poder mirar un val que NO és de qui el bescanvia, i
 * obrir això a la RLS voldria dir deixar que qualsevol client llegís els vals
 * de qualsevol altre. La regla de qui pot veure què es decideix aquí, funció
 * per funció, i la RLS es queda com a segona barrera per a l'accés directe.
 */

// ─── Codi ───────────────────────────────────────────────────────────────────

/**
 * Sense O/0 ni I/1: un codi es dicta per telèfon i es copia d'un paper imprès.
 * Mateix alfabet que els codis de referit, per la mateixa raó.
 */
const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomBlock(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++)
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  return out;
}

/** "VINDI-A3K9-P7QW". */
export function generateVoucherCode(): string {
  return `VINDI-${randomBlock(4)}-${randomBlock(4)}`;
}

/**
 * Normalitza el que escriu qui bescanvia: majúscules, sense espais i tolerant
 * amb els guions, que és el que més falla en copiar d'un paper.
 */
export function normalizeVoucherCode(input: string): string {
  const clean = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!clean.startsWith("VINDI") || clean.length !== 13) return input.trim().toUpperCase();
  return `VINDI-${clean.slice(5, 9)}-${clean.slice(9, 13)}`;
}

// ─── Caducitat ──────────────────────────────────────────────────────────────

/**
 * Data de caducitat d'un val comprat ARA, segons la configuració d'aquest
 * moment. Es desa al val i no es torna a calcular: si demà el centre canvia els
 * mesos de validesa, els vals ja venuts conserven la seva data.
 *
 * Mateixa aritmètica que `expiryForNewBono`: el dia 0 del mes següent és
 * l'últim del mes, de manera que el 31 de gener + 1 mes cau al 28/29 de febrer
 * i no salta al març.
 */
export function giftVoucherExpiry(months: number, from: string = centerToday()): string {
  const [y, m, d] = from.split("-").map(Number);
  const total = m - 1 + Math.max(1, months);
  const ty = y + Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ty}-${pad(tm)}-${pad(Math.min(d, lastDay))}`;
}

/** Un val caduca a la mitjanit del CENTRE del dia que hi consta. */
function isExpired(v: { status: GiftVoucherStatus; expires_at: string }, today = centerToday()) {
  return (
    (v.status === "pending_payment" || v.status === "active") &&
    v.expires_at < today
  );
}

/**
 * Marca com 'expired' els vals que ja ho estan. Peresós i oportunista, com els
 * bons i les sessions de prova: no cal cap cron. Encara que no s'hagi passat,
 * el canvi comprova la data igualment, així que un val caducat no és
 * bescanviable ni un instant abans que s'hi escrigui l'estat.
 */
export async function sweepExpiredGiftVouchers(): Promise<void> {
  const today = centerToday();

  if (USE_MOCK) {
    const store = getStore();
    let changed = false;
    for (const v of store.gift_vouchers)
      if (isExpired(v, today)) {
        v.status = "expired";
        changed = true;
      }
    if (changed) saveStore(store);
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("gift_vouchers")
    .update({ status: "expired" })
    .in("status", ["pending_payment", "active"])
    .lt("expires_at", today);
}

// ─── Lectura ────────────────────────────────────────────────────────────────

export type GiftVoucher = {
  id: string;
  code: string;
  buyerName: string;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  price: number;
  serviceType: ServiceType;
  totalSessions: number;
  packageName: string;
  purchasedAt: string;
  expiresAt: string;
  status: GiftVoucherStatus;
  redeemedAt: string | null;
  redeemedByName: string | null;
  pdfPath: string | null;
};

type Row = {
  id: string;
  code: string;
  recipient_name: string | null;
  recipient_email: string | null;
  message: string | null;
  price: number;
  service_type: ServiceType;
  total_sessions: number;
  package_name: string;
  purchased_at: string;
  expires_at: string;
  status: GiftVoucherStatus;
  redeemed_at: string | null;
  pdf_path: string | null;
  buyer?: { profile: { full_name: string | null } | null } | null;
  redeemer?: { profile: { full_name: string | null } | null } | null;
};

const SELECT = `id, code, recipient_name, recipient_email, message, price,
  service_type, total_sessions, package_name, purchased_at, expires_at, status,
  redeemed_at, pdf_path,
  buyer:clients!gift_vouchers_buyer_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
  redeemer:clients!gift_vouchers_redeemed_by_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`;

function toVoucher(r: Row): GiftVoucher {
  return {
    id: r.id,
    code: r.code,
    buyerName: r.buyer?.profile?.full_name ?? "—",
    recipientName: r.recipient_name,
    recipientEmail: r.recipient_email,
    message: r.message,
    price: Number(r.price),
    serviceType: r.service_type,
    totalSessions: r.total_sessions,
    packageName: r.package_name,
    purchasedAt: r.purchased_at,
    expiresAt: r.expires_at,
    status: r.status,
    redeemedAt: r.redeemed_at,
    redeemedByName: r.redeemer?.profile?.full_name ?? null,
    pdfPath: r.pdf_path,
  };
}

/** Nom d'un client al mock, per no repetir el doble salt clients→profiles. */
function mockName(clientId: string | null): string | null {
  if (!clientId) return null;
  const store = getStore();
  const c = store.clients.find((x) => x.id === clientId);
  return store.profiles.find((p) => p.id === c?.profile_id)?.full_name ?? null;
}

export async function listGiftVouchersAdmin(): Promise<GiftVoucher[]> {
  await sweepExpiredGiftVouchers();

  if (USE_MOCK) {
    return getStore()
      .gift_vouchers.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => ({
        ...toVoucher(v as unknown as Row),
        buyerName: mockName(v.buyer_client_id) ?? "—",
        redeemedByName: mockName(v.redeemed_by_client_id),
      }));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gift_vouchers")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toVoucher);
}

/** Els vals que ha comprat aquest client (per al seu historial). */
export async function listGiftVouchersBought(clientId: string): Promise<GiftVoucher[]> {
  await sweepExpiredGiftVouchers();

  if (USE_MOCK) {
    return getStore()
      .gift_vouchers.filter((v) => v.buyer_client_id === clientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => ({
        ...toVoucher(v as unknown as Row),
        buyerName: mockName(v.buyer_client_id) ?? "—",
        redeemedByName: mockName(v.redeemed_by_client_id),
      }));
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_vouchers")
    .select(SELECT)
    .eq("buyer_client_id", clientId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Row[]).map(toVoucher);
}

/** Un val concret. Sense comprovar permisos: qui crida ha de fer-ho abans. */
export async function getGiftVoucher(id: string): Promise<GiftVoucher | null> {
  if (USE_MOCK) {
    const v = getStore().gift_vouchers.find((x) => x.id === id);
    if (!v) return null;
    return {
      ...toVoucher(v as unknown as Row),
      buyerName: mockName(v.buyer_client_id) ?? "—",
      redeemedByName: mockName(v.redeemed_by_client_id),
    };
  }
  const admin = createAdminClient();
  const { data } = await admin.from("gift_vouchers").select(SELECT).eq("id", id).maybeSingle();
  return data ? toVoucher(data as unknown as Row) : null;
}

/** El client propietari d'un val (comprador), per comprovar qui el descarrega. */
export async function giftVoucherBuyerId(id: string): Promise<string | null> {
  if (USE_MOCK)
    return getStore().gift_vouchers.find((x) => x.id === id)?.buyer_client_id ?? null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_vouchers")
    .select("buyer_client_id")
    .eq("id", id)
    .maybeSingle();
  return data?.buyer_client_id ?? null;
}

/**
 * Queden vals venuts sense bescanviar?
 *
 * Serveix per decidir si s'ensenya el camp de canvi encara que el mòdul estigui
 * apagat: apagar la venda no pot deixar sense sortida algú que ja ha pagat un
 * regal. Torna un booleà del centre, no dades de ningú.
 */
export async function hasOutstandingGiftVouchers(): Promise<boolean> {
  if (USE_MOCK)
    return getStore().gift_vouchers.some(
      (v) => v.status === "active" || v.status === "pending_payment",
    );

  const admin = createAdminClient();
  const { count } = await admin
    .from("gift_vouchers")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "pending_payment"]);
  return (count ?? 0) > 0;
}

// ─── Compra ─────────────────────────────────────────────────────────────────

export type CreateGiftVoucherInput = {
  profileId: string;
  serviceId: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
};

export type GiftVoucherQuote = {
  clientId: string;
  serviceId: string;
  serviceType: ServiceType;
  totalSessions: number;
  packageName: string;
  finalPrice: number;
};

/**
 * Preu i paquet d'un val, resolts al servidor.
 *
 * S'apliquen les ofertes públiques del catàleg però NO la recompensa de referit
 * del comprador: aquell descompte és personal, i gastar-lo en un paquet que
 * farà servir un altre no és el que espera ningú. Igual que amb els bons, viu
 * en una sola funció perquè el que cobra Stripe i el que es desa al val no
 * puguin divergir mai.
 */
export async function quoteGiftVoucher(input: {
  profileId: string;
  serviceId: string;
}): Promise<GiftVoucherQuote> {
  let clientId: string;
  let s: {
    id: string;
    service_type: ServiceType;
    name: string;
    price: number;
    default_sessions: number;
    active: boolean;
  };

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("Client no trobat.");
    const row = store.services.find((x) => x.id === input.serviceId && x.active);
    if (!row) throw new Error("Servei no vàlid.");
    clientId = client.id;
    s = row;
  } else {
    const admin = createAdminClient();
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (!client) throw new Error("Client no trobat.");

    const { data: row } = await admin
      .from("services")
      .select("id, service_type, name, price, default_sessions, active")
      .eq("id", input.serviceId)
      .maybeSingle();
    if (!row || !row.active) throw new Error("Servei no vàlid.");
    clientId = client.id;
    s = row;
  }

  const ep = await getEffectivePrice({
    id: s.id,
    serviceType: s.service_type,
    name: s.name,
    price: s.price,
    defaultSessions: s.default_sessions,
    active: s.active,
  });

  return {
    clientId,
    serviceId: s.id,
    serviceType: s.service_type,
    totalSessions: s.default_sessions,
    packageName: s.name,
    finalPrice: ep.finalPrice,
  };
}

/**
 * Crea un val a partir d'una fotografia JA resolta del paquet.
 *
 * És el que fa servir el webhook de Stripe. No torna a consultar el catàleg ni
 * mira l'interruptor del mòdul, i és a posta: quan arriba el webhook els diners
 * ja hi són, i si entremig el centre ha desactivat un servei o ha tancat la
 * venda de vals, negar-se a crear el val deixaria un cobrament sense res a
 * canvi. Mateix criteri que amb la llista d'espera a la 0052: es tanca la
 * venda, no el que ja s'ha venut.
 */
export async function createGiftVoucherFromSnapshot(input: {
  snapshot: GiftVoucherQuote;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
  status: Extract<GiftVoucherStatus, "pending_payment" | "active">;
  stripeCheckoutSessionId?: string | null;
  /** Preu ja cobrat, si ve d'un pagament. Si no, el de la fotografia. */
  price?: number;
  expiryMonths: number;
}): Promise<{ id: string; code: string } | null> {
  const q = input.snapshot;
  const expiresAt = giftVoucherExpiry(input.expiryMonths);
  const recipientName = clean(input.recipientName, 120);
  const recipientEmail = clean(input.recipientEmail, 160);
  const message = clean(input.message, 500);
  const price = input.price ?? q.finalPrice;
  const sessionId = input.stripeCheckoutSessionId ?? null;

  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    const code = generateVoucherCode();
    const now = new Date().toISOString();
    store.gift_vouchers.push({
      id,
      code,
      service_id: q.serviceId,
      buyer_client_id: q.clientId,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      message,
      price,
      service_type: q.serviceType,
      total_sessions: q.totalSessions,
      package_name: q.packageName,
      purchased_at: now,
      expires_at: expiresAt,
      status: input.status,
      redeemed_at: null,
      redeemed_by_client_id: null,
      redeemed_bono_id: null,
      pdf_path: null,
      stripe_checkout_session_id: sessionId,
      created_at: now,
    });
    saveStore(store);
    return { id, code };
  }

  const admin = createAdminClient();

  // El codi és únic a la base. Si el sorteig xoca amb un que ja existeix, es
  // torna a provar: amb 31^8 combinacions no hauria de passar mai, però un
  // error 23505 a la cara de qui compra sí que seria un problema real.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateVoucherCode();
    const { data, error } = await admin
      .from("gift_vouchers")
      .insert({
        code,
        service_id: q.serviceId,
        buyer_client_id: q.clientId,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        message,
        price,
        service_type: q.serviceType,
        total_sessions: q.totalSessions,
        package_name: q.packageName,
        expires_at: expiresAt,
        status: input.status,
        stripe_checkout_session_id: sessionId,
      })
      .select("id, code")
      .single();
    if (!error && data) return { id: data.id, code: data.code };
    if (error?.code !== "23505") throw new Error("No s'ha pogut crear el val.");
    // Dos índexs únics poden saltar aquí. Si el que ha rebotat és el de la
    // sessió de Stripe, aquest val JA existeix i tornar-ho a provar amb un
    // codi nou només crearia el duplicat que volíem evitar.
    if (error.message.includes("stripe_session")) return null;
  }
  throw new Error("No s'ha pogut generar un codi lliure. Torna-ho a provar.");
}

/**
 * Crea un val 'pending_payment' per pagar al centre.
 *
 * El preu i les sessions surten del CATÀLEG, mai del navegador: el client només
 * envia quin paquet vol.
 */
export async function createGiftVoucher(
  input: CreateGiftVoucherInput,
): Promise<{ id: string; code: string }> {
  const settings = await getCenterSettings();
  if (!settings.giftVouchersEnabled)
    throw new Error("Els vals de regal no estan disponibles ara mateix.");

  const snapshot = await quoteGiftVoucher({
    profileId: input.profileId,
    serviceId: input.serviceId,
  });

  const created = await createGiftVoucherFromSnapshot({
    snapshot,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    message: input.message,
    status: "pending_payment",
    expiryMonths: settings.giftVoucherExpiryMonths,
  });
  // Sense sessió de Stripe l'únic de la 0054 no hi participa, així que aquí
  // mai pot tornar null.
  if (!created) throw new Error("No s'ha pogut crear el val.");
  return created;
}

/** El val d'una sessió de Checkout, per a la pantalla de tornada de Stripe. */
export async function getGiftVoucherByStripeSession(
  sessionId: string,
): Promise<GiftVoucher | null> {
  if (USE_MOCK) {
    const v = getStore().gift_vouchers.find(
      (x) => x.stripe_checkout_session_id === sessionId,
    );
    if (!v) return null;
    return {
      ...toVoucher(v as unknown as Row),
      buyerName: mockName(v.buyer_client_id) ?? "—",
      redeemedByName: mockName(v.redeemed_by_client_id),
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_vouchers")
    .select(SELECT)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  return data ? toVoucher(data as unknown as Row) : null;
}

function clean(value: string | null | undefined, max: number): string | null {
  const v = (value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

/** Desa la ruta del PDF un cop pujat. */
export async function setGiftVoucherPdfPath(id: string, path: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const v = store.gift_vouchers.find((x) => x.id === id);
    if (v) v.pdf_path = path;
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  await admin.from("gift_vouchers").update({ pdf_path: path }).eq("id", id);
}

// ─── Administració ──────────────────────────────────────────────────────────

/**
 * L'admin confirma que ha cobrat el val: passa a 'active' i, a partir d'aquí,
 * ja es pot bescanviar. Es registra el cobrament com el d'un bo, perquè els
 * diners que entren al centre siguin els mateixos miri's on es miri.
 */
export async function markGiftVoucherPaid(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const v = store.gift_vouchers.find((x) => x.id === id);
    if (!v) throw new Error("Val no trobat.");
    if (v.status !== "pending_payment")
      throw new Error("Aquest val no està pendent de pagament.");
    v.status = "active";
    saveStore(store);
    await createPayment({
      clientId: v.buyer_client_id,
      bonoId: null,
      amount: Number(v.price),
      method: "cash",
      concept: voucherConcept(v.service_type, v.total_sessions, v.code),
    });
    return;
  }

  const admin = createAdminClient();
  const { data: v } = await admin
    .from("gift_vouchers")
    .select("id, status, price, buyer_client_id, service_type, total_sessions, code")
    .eq("id", id)
    .maybeSingle();
  if (!v) throw new Error("Val no trobat.");
  if (v.status !== "pending_payment")
    throw new Error("Aquest val no està pendent de pagament.");

  const { error } = await admin
    .from("gift_vouchers")
    .update({ status: "active" })
    .eq("id", id)
    // Condició de cursa: si dos administradors el marquen alhora, només un
    // arriba a canviar la fila i només es registra un cobrament.
    .eq("status", "pending_payment");
  if (error) throw new Error("No s'ha pogut marcar com a pagat.");

  await createPayment({
    clientId: v.buyer_client_id,
    bonoId: null,
    amount: Number(v.price),
    method: "cash",
    concept: voucherConcept(v.service_type, v.total_sessions, v.code),
  });
}

/** Concepte comptable del cobrament d'un val. */
export function voucherConcept(
  serviceType: ServiceType,
  totalSessions: number,
  code: string,
): string {
  return `Val de regal ${code} · ${totalSessions} ${totalSessions === 1 ? "sessió" : "sessions"} · ${SERVICE_LABELS[serviceType]}`;
}

/** L'admin anul·la un val. Un de bescanviat ja no es toca: el bo existeix. */
export async function cancelGiftVoucher(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const v = store.gift_vouchers.find((x) => x.id === id);
    if (!v) throw new Error("Val no trobat.");
    if (v.status === "redeemed")
      throw new Error("Aquest val ja s'ha bescanviat: no es pot anul·lar.");
    v.status = "cancelled";
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  const { data: v } = await admin
    .from("gift_vouchers")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!v) throw new Error("Val no trobat.");
  if (v.status === "redeemed")
    throw new Error("Aquest val ja s'ha bescanviat: no es pot anul·lar.");
  await admin.from("gift_vouchers").update({ status: "cancelled" }).eq("id", id);
}

// ─── Canvi ──────────────────────────────────────────────────────────────────

/**
 * Per què no s'ha pogut bescanviar.
 *
 * Es torna un CODI i no un text: aquesta capa corre al servidor, sense saber en
 * quin idioma llegeix qui ho ha demanat. El text el posa la pantalla, que sí
 * que ho sap. Abans les frases vivien aquí i sortien sempre en català encara
 * que l'app estigués en anglès.
 */
export type RedeemErrorCode =
  | "not_found"
  | "already_redeemed"
  | "cancelled"
  | "expired"
  | "pending_payment"
  | "no_client"
  | "failed";

export type RedeemResult =
  | {
      ok: true;
      voucherId: string;
      sessions: number;
      serviceType: ServiceType;
      packageName: string;
    }
  | { ok: false; code: RedeemErrorCode };

/**
 * Bescanvia un val per un bo a nom de qui el presenta.
 *
 * Aquí es concentra la decisió de fons: NOMÉS un val 'active'. Un
 * 'pending_payment' es rebutja amb un missatge que diu exactament què passa,
 * perquè qui el té no ha fet res malament —el centre encara no ha cobrat— i ha
 * de saber a qui reclamar.
 *
 * El bo que en surt neix 'active': el val ja està cobrat, i qui el bescanvia no
 * deu res a ningú.
 */
export async function redeemGiftVoucher(input: {
  code: string;
  profileId: string;
}): Promise<RedeemResult> {
  const code = normalizeVoucherCode(input.code);
  if (!code) return { ok: false, code: "not_found" };

  const today = centerToday();

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) return { ok: false, code: "no_client" };
    const v = store.gift_vouchers.find((x) => x.code === code);
    if (!v) return { ok: false, code: "not_found" };
    const invalid = reject(v.status, v.expires_at, today);
    if (invalid) return { ok: false, code: invalid };

    const bonoId = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id: bonoId,
      client_id: client.id,
      service_type: v.service_type,
      total_sessions: v.total_sessions,
      remaining_sessions: v.total_sessions,
      price: Number(v.price),
      status: "active",
      purchased_at: now,
      expires_at: null,
      first_reservation_at: null,
      gift_voucher_id: v.id,
      stripe_checkout_session_id: null,
      created_at: now,
    });
    v.status = "redeemed";
    v.redeemed_at = now;
    v.redeemed_by_client_id = client.id;
    v.redeemed_bono_id = bonoId;
    saveStore(store);
    return {
      ok: true,
      voucherId: v.id,
      sessions: v.total_sessions,
      serviceType: v.service_type,
      packageName: v.package_name,
    };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (!client) return { ok: false, code: "no_client" };

  const { data: v } = await admin
    .from("gift_vouchers")
    .select("id, status, expires_at, service_type, total_sessions, price, package_name, buyer_client_id")
    .eq("code", code)
    .maybeSingle();
  if (!v) return { ok: false, code: "not_found" };

  const invalid = reject(v.status, v.expires_at, today);
  if (invalid) return { ok: false, code: invalid };

  // El bo neix amb la caducitat pròpia dels bons? No: un val ja té la seva
  // data i qui el bescanvia ho fa el dia que vol. A partir d'aquí les sessions
  // no caduquen, com passa amb un bo regalat en paper.
  const { data: bono, error: bErr } = await admin
    .from("bonos")
    .insert({
      client_id: client.id,
      service_type: v.service_type,
      total_sessions: v.total_sessions,
      remaining_sessions: v.total_sessions,
      price: Number(v.price),
      status: "active",
      expires_at: null,
      gift_voucher_id: v.id,
    })
    .select("id")
    .single();
  if (bErr || !bono) return { ok: false, code: "failed" };

  // El `eq("status", "active")` és el que impedeix el doble canvi: si dues
  // peticions arriben alhora, només una troba el val encara actiu.
  const { data: updated } = await admin
    .from("gift_vouchers")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeemed_by_client_id: client.id,
      redeemed_bono_id: bono.id,
    })
    .eq("id", v.id)
    .eq("status", "active")
    .select("id");

  if (!updated || updated.length === 0) {
    // Ha guanyat l'altra petició: es desfà el bo que acabem de crear perquè no
    // quedin dos bons per un sol val.
    await admin.from("bonos").delete().eq("id", bono.id);
    return { ok: false, code: "already_redeemed" };
  }

  return {
    ok: true,
    voucherId: v.id,
    sessions: v.total_sessions,
    serviceType: v.service_type,
    packageName: v.package_name,
  };
}

/** Motiu pel qual un val NO es pot bescanviar, o null si sí que es pot. */
function reject(
  status: GiftVoucherStatus,
  expiresAt: string,
  today: string,
): RedeemErrorCode | null {
  if (status === "redeemed") return "already_redeemed";
  if (status === "cancelled") return "cancelled";
  if (status === "expired" || expiresAt < today) return "expired";
  if (status === "pending_payment") return "pending_payment";
  return null;
}

/** Qui va comprar el val i quin regal era, per avisar-lo quan el bescanvien. */
export async function giftVoucherBuyerContact(voucherId: string): Promise<{
  profileId: string;
  recipientName: string | null;
  packageName: string;
} | null> {
  if (USE_MOCK) {
    const store = getStore();
    const v = store.gift_vouchers.find((x) => x.id === voucherId);
    if (!v) return null;
    const c = store.clients.find((x) => x.id === v.buyer_client_id);
    if (!c) return null;
    return {
      profileId: c.profile_id,
      recipientName: v.recipient_name,
      packageName: v.package_name,
    };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_vouchers")
    .select("recipient_name, package_name, buyer:clients!gift_vouchers_buyer_client_id_fkey(profile_id)")
    .eq("id", voucherId)
    .maybeSingle();
  const row = data as unknown as {
    recipient_name: string | null;
    package_name: string;
    buyer: { profile_id: string } | null;
  } | null;
  if (!row?.buyer?.profile_id) return null;
  return {
    profileId: row.buyer.profile_id,
    recipientName: row.recipient_name,
    packageName: row.package_name,
  };
}
