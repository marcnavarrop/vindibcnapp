import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { getCenterSettings } from "@/lib/data/center-settings";
import { loadClientAndService } from "@/lib/data/bonos";
import { centerToday } from "@/lib/center-time";
import { anchorDayFor, renewalAfter } from "@/lib/subscription-cycle";
import { cycleExpiry, previousDay } from "@/lib/subscription-cycle";
import type {
  BonoStatus,
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

/**
 * L'identificador de client d'un perfil, i res més.
 *
 * Va per `service_role` i demana una sola columna, com fa
 * `loadClientAndService`. NO es fa servir `getClientByProfile`, que és el camí
 * de les pantalles: aquell porta la fitxa sencera —bons, cobraments, etiquetes—
 * per un id, i va pel client de SESSIÓ, de manera que només funciona dins d'una
 * petició. Aquí en necessitem menys i en llocs on no sempre hi ha sessió.
 */
export async function clientIdForProfile(profileId: string): Promise<string | null> {
  if (USE_MOCK)
    return getStore().clients.find((c) => c.profile_id === profileId)?.id ?? null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data?.id ?? null;
}

/** La subscripció viva d'un perfil, resolent-ne el client pel camí de sobre. */
export async function getLiveSubscriptionForProfile(
  profileId: string,
  serviceType: ServiceType = SUBSCRIBABLE_SERVICE_TYPE,
): Promise<Subscription | null> {
  const clientId = await clientIdForProfile(profileId);
  return clientId ? getLiveSubscription(clientId, serviceType) : null;
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

// ─── El bo de cada mes ───────────────────────────────────────────────────────

export type CycleBono = {
  id: string;
  status: BonoStatus;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  expiresAt: string | null;
};

/** Estats en què el bo d'un cicle encara no s'ha cobrat. */
const UNSETTLED: BonoStatus[] = ["pending_payment", "unpaid"];

/**
 * El bo BASE d'un cicle (no els extres), si ja s'ha emès.
 *
 * Només n'hi pot haver un: ho garanteix l'índex parcial
 * `bonos_subscription_cycle_uidx` de la 0072, no aquesta consulta.
 */
export async function getCycleBono(
  subscriptionId: string,
  cycleStart: string,
): Promise<CycleBono | null> {
  if (USE_MOCK) {
    const b = getStore().bonos.find(
      (x) =>
        x.subscription_id === subscriptionId &&
        x.subscription_cycle_start === cycleStart &&
        !x.is_subscription_extra,
    );
    return b
      ? {
          id: b.id,
          status: b.status,
          totalSessions: b.total_sessions,
          remainingSessions: b.remaining_sessions,
          price: b.price,
          expiresAt: b.expires_at,
        }
      : null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bonos")
    .select("id, status, total_sessions, remaining_sessions, price, expires_at")
    .eq("subscription_id", subscriptionId)
    .eq("subscription_cycle_start", cycleStart)
    .eq("is_subscription_extra", false)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        status: data.status,
        totalSessions: data.total_sessions,
        remainingSessions: data.remaining_sessions,
        price: Number(data.price),
        expiresAt: data.expires_at,
      }
    : null;
}

/**
 * Emet el bo d'un cicle. ÚNIC camí pel qual una subscripció dona sessions.
 *
 * Que sigui un de sol és el que fa que el primer mes no pugui ser diferent de
 * la resta: l'alta i la renovació número catorze passen per aquí exactament
 * igual, i l'única cosa que canvia entre elles és l'estat amb què neix el bo
 * (`pending_payment` si es paga al centre, `active` si Stripe ja ha cobrat).
 *
 * LA CADUCITAT NO SURT DE `expiryForNewBono`. Un bo de subscripció no dura els
 * mesos que digui la configuració del centre: dura EL SEU CICLE i prou. És la
 * decisió que les sessions no s'acumulin, i viu aquí perquè és aquí on es
 * decideix. La data és l'últim dia abans de la renovació següent, de manera que
 * el bo vell i el nou no conviuen mai.
 *
 * QUI DIU QUAN S'ACABA EL CICLE depèn de com es paga, i això no és una
 * incoherència sinó la conseqüència d'una regla: manda el rellotge que cobra.
 * Al centre cobrem nosaltres i el calculem amb l'àncora (`cycleExpiry`); amb
 * targeta cobra Stripe i el període ens l'ha de dir ell (`cycleEnd`). Deduir-lo
 * pel nostre compte en el segon cas seria posar dos rellotges a decidir el
 * mateix mes: n'hi ha prou que algú es doni d'alta a les 00:30 d'aquí —quan a
 * UTC encara és ahir— perquè les dues respostes es separin un dia.
 *
 * Idempotent per l'índex únic de la 0072 i no per cap SELECT previ: el cron pot
 * córrer dos cops i el webhook de Stripe pot lliurar el mateix esdeveniment
 * dues vegades alhora. Mateix criteri que `createPaidBono`.
 */
export async function issueCycleBono(input: {
  subscription: Subscription;
  cycleStart: string;
  status: Extract<BonoStatus, "active" | "pending_payment">;
  /** El que s'ha cobrat de veritat. Per defecte, el preu congelat. */
  price?: number;
  /**
   * Primer dia del cicle SEGÜENT, quan qui el sap és Stripe. Sense això es
   * dedueix de l'àncora, que és el que val per als pagaments al centre.
   */
  cycleEnd?: string;
  stripeInvoiceId?: string | null;
}): Promise<{ id: string; created: boolean }> {
  const { subscription: sub, cycleStart } = input;
  const price = input.price ?? sub.unitPrice;
  const expiresAt = input.cycleEnd
    ? previousDay(input.cycleEnd)
    : cycleExpiry(cycleStart, sub.anchorDay);

  if (USE_MOCK) {
    const store = getStore();
    const existing = store.bonos.find(
      (x) =>
        x.subscription_id === sub.id &&
        x.subscription_cycle_start === cycleStart &&
        !x.is_subscription_extra,
    );
    if (existing) return { id: existing.id, created: false };

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id,
      client_id: sub.clientId,
      service_type: sub.serviceType,
      total_sessions: sub.sessionsPerCycle,
      remaining_sessions: sub.sessionsPerCycle,
      price,
      status: input.status,
      purchased_at: now,
      expires_at: expiresAt,
      first_reservation_at: null,
      gift_voucher_id: null,
      stripe_checkout_session_id: null,
      subscription_id: sub.id,
      subscription_cycle_start: cycleStart,
      is_subscription_extra: false,
      stripe_invoice_id: input.stripeInvoiceId ?? null,
      created_at: now,
    });
    saveStore(store);
    return { id, created: true };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bonos")
    .insert({
      client_id: sub.clientId,
      service_type: sub.serviceType,
      total_sessions: sub.sessionsPerCycle,
      remaining_sessions: sub.sessionsPerCycle,
      price,
      status: input.status,
      expires_at: expiresAt,
      subscription_id: sub.id,
      subscription_cycle_start: cycleStart,
      is_subscription_extra: false,
      stripe_invoice_id: input.stripeInvoiceId ?? null,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const existing = await getCycleBono(sub.id, cycleStart);
    if (!existing)
      throw new Error("El bo del cicle consta duplicat però no s'ha pogut recuperar.");
    return { id: existing.id, created: false };
  }
  if (error || !data)
    throw new Error(`No s'ha pogut emetre el bo del cicle: ${error?.message}`);
  return { id: data.id, created: true };
}

/**
 * ¿S'ha cobrat el mes d'aquest cicle?
 *
 * Es respon mirant si hi ha un COBRAMENT anotat per aquell bo, i no el seu
 * estat. L'estat sembla la resposta òbvia i no ho és, per una raó que costa de
 * veure i que trencaria el fre de la renovació sencer:
 *
 * El bo d'un cicle caduca l'últim dia ABANS de la renovació següent. O sigui
 * que el dia que toca renovar, el bo del mes que s'acaba ja ha passat de data i
 * `sweepExpiredBonos` —que és peresós i corre a cada consulta de bons, no
 * només al cron— l'haurà posat a 'expired'. I 'expired' és AMBIGU: hi arriben
 * igual el bo pagat amb sessions sense gastar i el que no s'ha cobrat mai.
 * Comprovant l'estat, el segon passaria per bo i el client aniria acumulant
 * mesos impagats, que és exactament el que aquest fre existeix per evitar.
 *
 * `payments` no té aquesta ambigüitat: la fila hi és o no hi és, i qui l'escriu
 * és sempre el mateix camí que activa el bo (`markBonoPaid`, `createPaidBono`).
 *
 * Ara bé, NOMÉS es consulta per a 'expired', que és l'únic estat ambigu. Mirar
 * el cobrament de tots seria pitjor, i en la direcció que fa mal: `markBonoPaid`
 * activa el bo i tot seguit anota el cobrament en dos passos, de manera que un
 * error entremig deixaria un bo 'active' sense fila a `payments`. Amb la regla
 * general, aquell client hauria pagat de veritat i se li aturaria la
 * subscripció igualment. Preferim equivocar-nos a favor seu: qui ha arribat a
 * 'active' o 'completed' ha passat per un camí que cobra.
 *
 * Un cicle sense cap bo no deu res: no s'ha arribat a emetre.
 */
export async function isCycleSettled(bono: CycleBono | null): Promise<boolean> {
  if (bono === null) return true;
  if (UNSETTLED.includes(bono.status)) return false;
  if (bono.status === "expired") return bonoHasPayment(bono.id);
  return true;
}

async function bonoHasPayment(bonoId: string): Promise<boolean> {
  if (USE_MOCK)
    return getStore().payments.some((p) => p.bono_id === bonoId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("id")
    .eq("bono_id", bonoId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Torna a posar en marxa una subscripció aturada per impagament.
 *
 * La crida `markBonoPaid` quan el bo que s'acaba de cobrar és el del cicle en
 * curs. NO ho fa pagar un extra: un extra és una sessió de més, no el mes; si
 * el mes segueix a deure, la subscripció ha de continuar aturada.
 *
 * No avança res: només torna l'estat a 'active'. La renovació que es va quedar
 * pendent la recull el barrido següent, que ja sap com posar-se al dia.
 */
export async function resumeAfterCyclePayment(bonoId: string): Promise<boolean> {
  const link = await bonoSubscriptionLink(bonoId);
  if (!link || link.isExtra) return false;

  const sub = await getSubscription(link.subscriptionId);
  if (!sub || sub.status !== "past_due") return false;
  if (sub.currentCycleStart !== link.cycleStart) return false;

  await updateSubscription(sub.id, { status: "active" });
  return true;
}

async function bonoSubscriptionLink(bonoId: string): Promise<{
  subscriptionId: string;
  cycleStart: string;
  isExtra: boolean;
} | null> {
  if (USE_MOCK) {
    const b = getStore().bonos.find((x) => x.id === bonoId);
    return b?.subscription_id && b.subscription_cycle_start
      ? {
          subscriptionId: b.subscription_id,
          cycleStart: b.subscription_cycle_start,
          isExtra: b.is_subscription_extra,
        }
      : null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bonos")
    .select("subscription_id, subscription_cycle_start, is_subscription_extra")
    .eq("id", bonoId)
    .maybeSingle();
  return data?.subscription_id && data.subscription_cycle_start
    ? {
        subscriptionId: data.subscription_id,
        cycleStart: data.subscription_cycle_start,
        isExtra: data.is_subscription_extra,
      }
    : null;
}

// ─── L'estat del mes en curs ────────────────────────────────────────────────

export type CycleState = {
  subscription: Subscription;
  /** El bo base del mes. Null només si encara no s'ha emès. */
  cycleBono: CycleBono | null;
  /** Els extres ja demanats aquest mes que encara compten. */
  extras: CycleBono[];
  /** Sessions disponibles al cicle, sumant el bo base i els extres. */
  sessionsLeft: number;
  /** Extres gastats de la quota del mes. */
  extrasUsed: number;
  extrasMax: number;
  /** Preu d'una sessió extra, si se'n pot demanar cap. */
  pricePerSession: number;
  /**
   * ¿Es pot demanar un extra ARA?
   *
   * Les mateixes condicions que comprova `claim_subscription_extra` (0073), i
   * per això es calculen en un sol lloc: aquí decideixen què s'ENSENYA i allà
   * decideixen què es permet, però si les dues respostes divergissin el client
   * veuria un botó que rebota.
   */
  canClaimExtra: boolean;
};

/**
 * Un extra anul·lat o decaigut no gasta quota: el client no l'ha arribat a
 * tenir. Mateixa llista que el `status not in (...)` de la 0073.
 */
const EXTRA_DOESNT_COUNT: BonoStatus[] = ["cancelled", "unpaid"];

/** Els extres d'un cicle, en ordre d'emissió. */
export async function getCycleExtras(
  subscriptionId: string,
  cycleStart: string,
): Promise<CycleBono[]> {
  if (USE_MOCK)
    return getStore()
      .bonos.filter(
        (b) =>
          b.subscription_id === subscriptionId &&
          b.subscription_cycle_start === cycleStart &&
          b.is_subscription_extra,
      )
      .map((b) => ({
        id: b.id,
        status: b.status,
        totalSessions: b.total_sessions,
        remainingSessions: b.remaining_sessions,
        price: b.price,
        expiresAt: b.expires_at,
      }));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bonos")
    .select("id, status, total_sessions, remaining_sessions, price, expires_at")
    .eq("subscription_id", subscriptionId)
    .eq("subscription_cycle_start", cycleStart)
    .eq("is_subscription_extra", true)
    .order("purchased_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    status: b.status,
    totalSessions: b.total_sessions,
    remainingSessions: b.remaining_sessions,
    price: Number(b.price),
    expiresAt: b.expires_at,
  }));
}

/**
 * Tot el que fa falta saber del mes en curs, resolt d'un cop.
 *
 * El preu per sessió surt del bo BASE d'aquest mes i no del catàleg. És el que
 * aquest client ha pagat de veritat aquest mes, així que una oferta segmentada
 * hi arriba sola: no cal tornar a consultar cap promoció ni recordar quina se
 * li va aplicar.
 */
export async function getCycleState(
  subscription: Subscription,
  today: string = centerToday(),
): Promise<CycleState> {
  const { subscriptionExtraSessionsMax, subscriptionsEnabled } =
    await getCenterSettings();

  const [cycleBono, extras] = await Promise.all([
    getCycleBono(subscription.id, subscription.currentCycleStart),
    getCycleExtras(subscription.id, subscription.currentCycleStart),
  ]);

  const usable = (b: CycleBono) =>
    (b.status === "active" || b.status === "pending_payment") &&
    (b.expiresAt === null || b.expiresAt >= today);

  const sessionsLeft = [cycleBono, ...extras]
    .filter((b): b is CycleBono => b !== null && usable(b))
    .reduce((n, b) => n + b.remainingSessions, 0);

  const extrasUsed = extras.filter(
    (b) => !EXTRA_DOESNT_COUNT.includes(b.status),
  ).length;

  return {
    subscription,
    cycleBono,
    extras,
    sessionsLeft,
    extrasUsed,
    extrasMax: subscriptionExtraSessionsMax,
    pricePerSession: cycleBono
      ? pricePerSession(cycleBono.price, cycleBono.totalSessions)
      : 0,
    canClaimExtra:
      subscriptionsEnabled &&
      subscription.status === "active" &&
      // Sense bo base no hi ha de què treure el preu per sessió, i tampoc hi ha
      // res que puguem dir que s'ha exhaurit. La 0073 el deixaria passar —una
      // suma sense files és zero— i per això es tanca aquí.
      cycleBono !== null &&
      sessionsLeft === 0 &&
      extrasUsed < subscriptionExtraSessionsMax,
  };
}

/**
 * Marca com a cobrat un bo de sessió extra que s'ha pagat amb targeta.
 *
 * El cobrament s'anota SEMPRE, encara que el bo ja no estigui pendent. És
 * deliberat: si el client va reservar amb l'extra i el termini de la 0044 el va
 * fer decaure abans que arribés el pagament, l'estat ja no seria
 * 'pending_payment' i amb un `where` estricte ens quedaríem els diners sense
 * cap fila a `payments`. L'anotació és idempotent per l'índex de la 0054, així
 * que repetir-la no fa mal; no anotar-la, sí.
 *
 * Torna si l'ha activat de veritat, per distingir el primer lliurament del
 * webhook dels següents.
 */
export async function markExtraBonoPaid(input: {
  bonoId: string;
  stripeCheckoutSessionId: string;
  price: number;
  stripePaymentId: string | null;
}): Promise<{ activated: boolean; clientId: string; serviceType: ServiceType } | null> {
  if (USE_MOCK) {
    const store = getStore();
    const b = store.bonos.find((x) => x.id === input.bonoId);
    if (!b) return null;
    const activated = b.status === "pending_payment" || b.status === "unpaid";
    if (activated) {
      b.status = "active";
      b.stripe_checkout_session_id = input.stripeCheckoutSessionId;
      saveStore(store);
    }
    return { activated, clientId: b.client_id, serviceType: b.service_type };
  }

  const admin = createAdminClient();
  const { data: bono } = await admin
    .from("bonos")
    .select("id, client_id, service_type, status")
    .eq("id", input.bonoId)
    .eq("is_subscription_extra", true)
    .maybeSingle();
  if (!bono) return null;

  let activated = false;
  if (bono.status === "pending_payment" || bono.status === "unpaid") {
    const { data } = await admin
      .from("bonos")
      .update({
        status: "active",
        stripe_checkout_session_id: input.stripeCheckoutSessionId,
      })
      .eq("id", input.bonoId)
      .in("status", ["pending_payment", "unpaid"])
      .select("id");
    activated = (data ?? []).length > 0;
  }

  return { activated, clientId: bono.client_id, serviceType: bono.service_type };
}
