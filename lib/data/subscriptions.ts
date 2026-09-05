import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { loadClientAndService } from "@/lib/data/bonos";
import { centerToday } from "@/lib/center-time";
import { anchorDayFor, renewalAfter } from "@/lib/subscription-cycle";
import type {
  PaymentMethod,
  ServiceType,
  SubscriptionStatus,
} from "@/types/database";

/**
 * Subscripció mensual als bons de grup (0072).
 *
 * Aquesta taula és la FONT DE VERITAT del que el client té dret a fer. Stripe,
 * quan es paga amb targeta, només hi posa els diners: si algun dia les dues
 * versions no coincideixen, mana aquesta i el que cal arreglar és el cobrament.
 *
 * Les dates es calculen SEMPRE amb `centerToday()` i les funcions pures de
 * `lib/subscription-cycle.ts`. Mai a la base: la zona horària del centre és
 * configurable per variable d'entorn.
 */

/** Només els bons de grup es poden subscriure. Ho diu també un check a la 0072. */
export const SUBSCRIBABLE_SERVICE_TYPE: ServiceType = "grupo_reducido";

export type Subscription = {
  id: string;
  clientId: string;
  serviceId: string;
  serviceType: ServiceType;
  sessionsPerCycle: number;
  packageName: string;
  /** Preu del cicle, congelat a l'alta. */
  unitPrice: number;
  paymentMethod: PaymentMethod;
  status: SubscriptionStatus;
  anchorDay: number;
  startedOn: string;
  currentCycleStart: string;
  /** Null només quan status='cancelled'. */
  nextRenewalOn: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  client_id: string;
  service_id: string;
  service_type: ServiceType;
  sessions_per_cycle: number;
  package_name: string;
  unit_price: number;
  payment_method: PaymentMethod;
  status: SubscriptionStatus;
  anchor_day: number;
  started_on: string;
  current_cycle_start: string;
  next_renewal_on: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
};

function toSubscription(r: Row): Subscription {
  return {
    id: r.id,
    clientId: r.client_id,
    serviceId: r.service_id,
    serviceType: r.service_type,
    sessionsPerCycle: r.sessions_per_cycle,
    packageName: r.package_name,
    // `numeric` arriba com a cadena des de PostgREST segons el camí; es força.
    unitPrice: Number(r.unit_price),
    paymentMethod: r.payment_method,
    status: r.status,
    anchorDay: r.anchor_day,
    startedOn: r.started_on,
    currentCycleStart: r.current_cycle_start,
    nextRenewalOn: r.next_renewal_on,
    cancelAtPeriodEnd: r.cancel_at_period_end,
    cancelledAt: r.cancelled_at,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    createdAt: r.created_at,
  };
}

const COLUMNS =
  "id, client_id, service_id, service_type, sessions_per_cycle, package_name, unit_price, payment_method, status, anchor_day, started_on, current_cycle_start, next_renewal_on, cancel_at_period_end, cancelled_at, stripe_customer_id, stripe_subscription_id, created_at";

// ─── Cotització ──────────────────────────────────────────────────────────────

export type SubscriptionQuote = {
  clientId: string;
  serviceId: string;
  serviceType: ServiceType;
  sessionsPerCycle: number;
  packageName: string;
  /** Preu que es congelarà a l'alta, amb l'oferta segmentada ja aplicada. */
  unitPrice: number;
};

/**
 * Preu i dades del paquet que es vol subscriure.
 *
 * Germana de `quoteBonoPurchase` i deliberadament MÉS CURTA que ella, en dos
 * punts que no són descuits:
 *
 * 1. NO hi entren les recompenses de referit. Una recompensa és d'un sol ús;
 *    aplicada a una subscripció es convertiria en un descompte perpetu, que no
 *    és el que se li va prometre a ningú. La recompensa es queda intacta per a
 *    una compra solta, que és per al que va néixer.
 *
 * 2. NOMÉS 'grupo_reducido'. Es comprova aquí i no només a la pantalla: la
 *    pantalla decideix què s'ensenya, però qui rep el `serviceId` és el
 *    servidor i no es pot refiar del que li arribi. A la base hi ha el mateix
 *    check, que és qui ho garanteix de veritat.
 *
 * Les OFERTES SEGMENTADES sí que hi entren, i per això es passa el `clientId`:
 * el preu que es congela ha de ser el que aquest client veu a la pantalla. És
 * la mateixa crida que fa /client/bonos, i per això dona el mateix número.
 */
export async function quoteSubscription(input: {
  profileId: string;
  serviceId: string;
}): Promise<SubscriptionQuote> {
  const { getEffectivePrice } = await import("@/lib/data/promotions");
  const { clientId, service } = await loadClientAndService(input);

  if (service.serviceType !== SUBSCRIBABLE_SERVICE_TYPE)
    throw new Error("Aquest servei no es pot subscriure.");

  const ep = await getEffectivePrice(service, { clientId });

  return {
    clientId,
    serviceId: service.id,
    serviceType: service.serviceType,
    sessionsPerCycle: service.defaultSessions,
    packageName: service.name,
    unitPrice: ep.finalPrice,
  };
}

/**
 * Preu d'UNA sessió d'aquesta subscripció, que és el que costa una sessió extra.
 *
 * Surt del que el client paga de veritat cada mes, no del catàleg: així una
 * oferta segmentada arriba a l'extra sola, sense haver de tornar a consultar
 * cap promoció. Arrodonit a cèntims perquè el preu del cicle és un enter
 * d'euros (`computeEffectivePrice` arrodoneix) però dividit per 3 o per 6 no ho
 * és.
 */
export function pricePerSession(unitPrice: number, sessions: number): number {
  if (sessions <= 0) throw new Error("Un paquet ha de tenir sessions.");
  return Math.round((unitPrice / sessions) * 100) / 100;
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

/** Estats en què una subscripció encara existeix per al client. */
const LIVE: SubscriptionStatus[] = ["active", "past_due"];

/**
 * La subscripció viva d'un client per a un tipus de servei, si en té.
 *
 * Només n'hi pot haver una: ho garanteix l'índex parcial
 * `subscriptions_one_live_per_client` de la 0072, no aquesta consulta.
 */
export async function getLiveSubscription(
  clientId: string,
  serviceType: ServiceType = SUBSCRIBABLE_SERVICE_TYPE,
): Promise<Subscription | null> {
  if (USE_MOCK) {
    const s = getStore().subscriptions.find(
      (x) =>
        x.client_id === clientId &&
        x.service_type === serviceType &&
        LIVE.includes(x.status),
    );
    return s ? toSubscription(s as Row) : null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .eq("client_id", clientId)
    .eq("service_type", serviceType)
    .in("status", LIVE)
    .maybeSingle();
  if (error) throw error;
  return data ? toSubscription(data as Row) : null;
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  if (USE_MOCK) {
    const s = getStore().subscriptions.find((x) => x.id === id);
    return s ? toSubscription(s as Row) : null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toSubscription(data as Row) : null;
}

/**
 * La subscripció d'un identificador de Stripe. La necessita el webhook, que no
 * sap res dels nostres identificadors i només porta el seu.
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Promise<Subscription | null> {
  if (USE_MOCK) {
    const s = getStore().subscriptions.find(
      (x) => x.stripe_subscription_id === stripeSubscriptionId,
    );
    return s ? toSubscription(s as Row) : null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) throw error;
  return data ? toSubscription(data as Row) : null;
}

/** Totes les subscripcions, per al panell de l'admin. Les vives primer. */
export async function listSubscriptions(): Promise<Subscription[]> {
  if (USE_MOCK)
    return getStore()
      .subscriptions.map((s) => toSubscription(s as Row))
      .sort(byLiveThenRenewal);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toSubscription).sort(byLiveThenRenewal);
}

function byLiveThenRenewal(a: Subscription, b: Subscription): number {
  const live = (s: Subscription) => (LIVE.includes(s.status) ? 0 : 1);
  return (
    live(a) - live(b) ||
    (a.nextRenewalOn ?? "9999").localeCompare(b.nextRenewalOn ?? "9999")
  );
}

/**
 * Les que toca renovar avui o abans. Les d'abans hi són a posta: si el cron no
 * va córrer un dia —o va fallar—, l'endemà s'han de recuperar igualment en
 * comptes de saltar-se un mes en silenci.
 *
 * Les 'past_due' no hi entren: una subscripció aturada per impagament no
 * renova fins que es cobri el que deu.
 */
export async function listSubscriptionsDueForRenewal(
  today: string = centerToday(),
): Promise<Subscription[]> {
  if (USE_MOCK)
    return getStore()
      .subscriptions.filter(
        (s) =>
          s.status === "active" &&
          s.next_renewal_on !== null &&
          s.next_renewal_on <= today,
      )
      .map((s) => toSubscription(s as Row));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .eq("status", "active")
    .not("next_renewal_on", "is", null)
    .lte("next_renewal_on", today)
    .order("next_renewal_on", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toSubscription);
}

// ─── Escriptura ──────────────────────────────────────────────────────────────

export type NewSubscription = {
  quote: SubscriptionQuote;
  paymentMethod: PaymentMethod;
  /** Només amb targeta: els identificadors que ja porta el webhook de Stripe. */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  /** Dia d'alta. Per defecte, avui al centre. */
  startedOn?: string;
};

/**
 * Dona d'alta una subscripció, amb el seu primer cicle ja obert.
 *
 * NO crea el bo del primer mes: qui l'emet és el mateix camí que emetrà els
 * dels mesos següents, i que sigui un de sol és el que fa que el primer mes no
 * pugui ser diferent de la resta.
 *
 * Un 23505 aquí vol dir que aquest client ja en té una de viva
 * (`subscriptions_one_live_per_client`). Es deixa sortir tal com és perquè qui
 * crida hi pugui reaccionar: al webhook de Stripe això és una situació que
 * s'ha de resoldre amb els diners a la mà, no un error qualsevol.
 */
export async function createSubscription(
  input: NewSubscription,
): Promise<Subscription> {
  const startedOn = input.startedOn ?? centerToday();
  const anchorDay = anchorDayFor(startedOn);
  const row = {
    client_id: input.quote.clientId,
    service_id: input.quote.serviceId,
    service_type: input.quote.serviceType,
    sessions_per_cycle: input.quote.sessionsPerCycle,
    package_name: input.quote.packageName,
    unit_price: input.quote.unitPrice,
    payment_method: input.paymentMethod,
    status: "active" as SubscriptionStatus,
    anchor_day: anchorDay,
    started_on: startedOn,
    current_cycle_start: startedOn,
    next_renewal_on: renewalAfter(startedOn, anchorDay),
    cancel_at_period_end: false,
    cancelled_at: null,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
  };

  if (USE_MOCK) {
    const store = getStore();
    const now = new Date().toISOString();
    // L'índex parcial de la 0072 no existeix al mock, així que la unicitat es
    // comprova aquí. No és la mateixa garantia —al mock no hi ha concurrència
    // que valgui la pena témer— però sí el mateix comportament.
    if (
      store.subscriptions.some(
        (s) =>
          s.client_id === row.client_id &&
          s.service_type === row.service_type &&
          LIVE.includes(s.status),
      )
    )
      throw new Error("Aquest client ja té una subscripció activa.");

    const full = { id: crypto.randomUUID(), ...row, created_at: now, updated_at: now };
    store.subscriptions.push(full);
    saveStore(store);
    return toSubscription(full as Row);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error || !data) throw error ?? new Error("No s'ha pogut crear la subscripció.");
  return toSubscription(data as Row);
}

export type SubscriptionPatch = {
  status?: SubscriptionStatus;
  currentCycleStart?: string;
  nextRenewalOn?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  unitPrice?: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

/**
 * Canvia el que se li digui d'una subscripció.
 *
 * Deliberadament tonta: no decideix res —ni quan toca pausar, ni quan avançar
 * el cicle—, només escriu. Les decisions viuen a qui la crida (el cron de
 * renovació, el webhook), perquè estan al costat del motiu que les justifica.
 *
 * Compte amb el constraint `subscriptions_renewal_matches_status` de la 0072:
 * passar a 'cancelled' exigeix `nextRenewalOn: null` i un `cancelledAt`, i
 * tornar a un estat viu exigeix una data de renovació. La base ho rebutja si no
 * quadra, que és exactament el que ha de fer.
 */
export async function updateSubscription(
  id: string,
  patch: SubscriptionPatch,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const s = store.subscriptions.find((x) => x.id === id);
    if (!s) throw new Error("Subscripció no trobada.");
    if (patch.status !== undefined) s.status = patch.status;
    if (patch.currentCycleStart !== undefined) s.current_cycle_start = patch.currentCycleStart;
    if (patch.nextRenewalOn !== undefined) s.next_renewal_on = patch.nextRenewalOn;
    if (patch.cancelAtPeriodEnd !== undefined) s.cancel_at_period_end = patch.cancelAtPeriodEnd;
    if (patch.cancelledAt !== undefined) s.cancelled_at = patch.cancelledAt;
    if (patch.unitPrice !== undefined) s.unit_price = patch.unitPrice;
    if (patch.stripeCustomerId !== undefined) s.stripe_customer_id = patch.stripeCustomerId;
    if (patch.stripeSubscriptionId !== undefined)
      s.stripe_subscription_id = patch.stripeSubscriptionId;
    s.updated_at = new Date().toISOString();
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.currentCycleStart !== undefined && { current_cycle_start: patch.currentCycleStart }),
      ...(patch.nextRenewalOn !== undefined && { next_renewal_on: patch.nextRenewalOn }),
      ...(patch.cancelAtPeriodEnd !== undefined && { cancel_at_period_end: patch.cancelAtPeriodEnd }),
      ...(patch.cancelledAt !== undefined && { cancelled_at: patch.cancelledAt }),
      ...(patch.unitPrice !== undefined && { unit_price: patch.unitPrice }),
      ...(patch.stripeCustomerId !== undefined && { stripe_customer_id: patch.stripeCustomerId }),
      ...(patch.stripeSubscriptionId !== undefined && {
        stripe_subscription_id: patch.stripeSubscriptionId,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
