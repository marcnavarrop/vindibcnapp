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
  releaseReferralRewardOfBono,
} from "@/lib/data/referral";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerToday } from "@/lib/center-time";
import { cancelBlockFor, CANCEL_BLOCK_LABELS } from "@/lib/bono-rules";
import { SERVICE_LABELS } from "@/lib/labels";
import { isSubscriptionOnly } from "@/lib/subscription-rules";
import type { ServiceType, BonoStatus, PaymentMethod } from "@/types/database";

/**
 * Un paquet marcat «només per subscripció» no es ven solt: la regla sencera i
 * el perquè viuen a `lib/subscription-rules.ts`. Aquí només se'n fa complir la
 * meitat que toca aquest mòdul, i es fa en els DOS naixements d'un bo que
 * passen per ell: `quoteBonoPurchase` (el client, pagui al centre o amb
 * targeta) i `createBono` (l'alta manual d'admin i professional).
 *
 * NO es comprova a `createPaidBono`, i és a posta: aquell el crida el webhook de
 * Stripe amb els diners ja cobrats. Un Checkout obert abans que el paquet
 * quedés marcat s'ha de complir igualment —negar-s'hi seria quedar-se els
 * diners sense donar res a canvi—. Mateix criteri que
 * `createGiftVoucherFromSnapshot`.
 *
 * El text no anomena el grup: des de la 0086 qualsevol paquet pot dur la
 * casella, i un missatge que parlés de grups mentiria el primer dia que
 * l'administració en marqui un de fisioteràpia.
 */
const PACKAGE_IS_SUBSCRIPTION_ONLY =
  "Aquest paquet només es pot contractar per subscripció.";

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
  /**
   * De quin client és. El nom no serveix per decidir res: la taula del
   * professional ha de saber quins bons són dels SEUS clients per ensenyar-hi
   * el botó de cobrar, i això es compara per id contra `listClients(trainerId)`.
   */
  clientId: string;
  clientName: string;
  serviceType: ServiceType;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  status: BonoStatus;
  /** Data de caducitat fixada en comprar-lo. Null = no caduca. */
  expiresAt: string | null;
  /**
   * El mes d'una subscripció, si n'és. La taula ho necessita per no oferir
   * d'anul·lar-lo: donar-se de baixa té el seu camí, i anul·lar el bo deixaria
   * la subscripció viva.
   */
  subscriptionId: string | null;
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
      clientId: b.client_id,
      clientName: clientName(b.client_id, store),
      serviceType: b.service_type,
      totalSessions: b.total_sessions,
      remainingSessions: b.remaining_sessions,
      price: b.price,
      status: b.status,
      expiresAt: b.expires_at ?? null,
      subscriptionId: b.subscription_id ?? null,
    }));
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonos")
    .select(
      `id, client_id, service_type, total_sessions, remaining_sessions, price, status, expires_at, subscription_id,
       client:clients!bonos_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    client_id: string;
    service_type: ServiceType;
    total_sessions: number;
    remaining_sessions: number;
    price: number;
    status: BonoStatus;
    expires_at: string | null;
    subscription_id: string | null;
    client: { profile: { full_name: string | null } | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.profile?.full_name ?? "—",
    serviceType: r.service_type,
    totalSessions: r.total_sessions,
    remainingSessions: r.remaining_sessions,
    price: r.price,
    status: r.status,
    expiresAt: r.expires_at,
    subscriptionId: r.subscription_id,
  }));
}

export type BonoInput = {
  clientId: string;
  serviceType: ServiceType;
  totalSessions: number;
  price: number;
  /**
   * El paquet del catàleg que s'està donant d'alta.
   *
   * OBLIGATORI DES DE LA 0086, per poder mirar la casella «només per
   * subscripció» abans d'escriure, que ja no es pot deduir del tipus de servei.
   *
   * I DES DE LA 0088 TAMBÉ ES DESA. Abans es llegia i es llençava, perquè
   * `bonos` només tenia `service_type` (0001); ara la fila guarda de quin
   * paquet ve, que és el que permet tornar-lo a vendre quan s'esgoti.
   *
   * Els dos formularis que hi arriben ja l'enviaven: el desplegable de
   * `BonoForm` es diu `serviceId` i el `serviceType` hi viatja en un camp
   * amagat. L'únic que calia era llegir-lo.
   */
  serviceId: string;
  /** Si se indica, registra el cobro del bono con este método. */
  paymentMethod?: PaymentMethod | null;
};

/**
 * La casella d'un paquet del catàleg, i res més.
 *
 * Deliberadament NO exigeix que el paquet estigui actiu, a diferència de
 * `loadClientAndService`: aquí no s'està cotitzant res —el preu i les sessions
 * ja venen decidits des de la fitxa— i desactivar un paquet del catàleg no ha
 * de trencar una alta manual que l'administració estigui fent a posta. El que
 * es vol saber és una sola cosa: si aquest paquet es ven solt.
 *
 * Un `serviceId` que no existeixi retorna null i per tant NO bloqueja: seria
 * una alta sense paquet reconeixible, i el que la ha d'aturar és la validació
 * del formulari, no aquesta regla.
 */
async function loadServicePackage(
  serviceId: string,
): Promise<{ subscription_only: boolean; active: boolean } | null> {
  if (USE_MOCK) {
    const row = getStore().services.find((x) => x.id === serviceId);
    return row
      ? { subscription_only: row.subscription_only, active: row.active }
      : null;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("services")
    .select("subscription_only, active")
    .eq("id", serviceId)
    .maybeSingle();
  return data ?? null;
}

/**
 * La renovació demanada a la compra, però només si aquest client la pot tenir.
 *
 * L'EXCLUSIVITAT AMB LA SUBSCRIPCIÓ ES COMPROVA ALS TRES NAIXEMENTS
 *
 * Les dues constraints de la 0088 cobreixen el que cap d'elles pot: que el bo
 * no vingui d'una subscripció i que sàpiga de quin paquet ve. La tercera
 * meitat de la regla —que el CLIENT no tingui ja subscripció viva d'aquest
 * servei— mira una altra taula i no cap en cap check de fila.
 *
 * Fins ara només la mirava l'interruptor d'«Els meus bons», i per això la
 * compra amb la casella marcada s'hi colava: el client es quedava amb dues
 * vies emetent bons del mateix servei.
 *
 * Es RETALLA en silenci i no es rebutja la compra sencera: el client volia el
 * bo, i negar-li la venda per una casella seria desproporcionat. Que no se li
 * ofereixi és feina de la pantalla, que amaga la casella quan la subscripció
 * és d'aquest mateix servei; això d'aquí és la xarxa de sota, per si arriba
 * igualment.
 */
async function autoRenewAllowed(
  clientId: string,
  serviceType: ServiceType,
  wanted: boolean | undefined,
): Promise<boolean> {
  if (wanted !== true) return false;
  // Import dinàmic per trencar el cicle: `subscriptions.ts` ja importa d'aquí.
  // Mateix recurs que `resumeSubscription` i `quoteBonoPurchase`.
  const { getLiveSubscription } = await import("@/lib/data/subscriptions");
  return (await getLiveSubscription(clientId, serviceType)) === null;
}

/** Crea un bono para un cliente (sesiones restantes = totales al comprarlo). */
export async function createBono(input: BonoInput): Promise<string> {
  // L'alta manual d'un paquet «només per subscripció» passa per la subscripció,
  // també quan la fa l'admin o el professional des de la fitxa del client. Es
  // comprova aquí i no només al formulari: que el desplegable no ho ofereixi no
  // impedeix cridar l'acció directament.
  //
  // Es rellegeix el paquet del catàleg en comptes de refiar-se del que arribi:
  // qui envia el formulari tria un `serviceId`, i la casella l'ha de dir la
  // base. Mateix criteri que `loadClientAndService` amb el preu i les sessions.
  if (isSubscriptionOnly(await loadServicePackage(input.serviceId)))
    throw new Error(PACKAGE_IS_SUBSCRIPTION_ONLY);

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
      subscription_id: null,
      subscription_cycle_start: null,
      is_subscription_extra: false,
      stripe_invoice_id: null,
      // D'on ha sortit aquest bo al catàleg (0088). Sense això no es pot
      // renovar: no sabríem quin paquet tornar a vendre.
      service_id: input.serviceId,
      auto_renew: false,
      renewed_from_bono_id: null,
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
        service_id: input.serviceId,
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

/**
 * La fitxa del client i el paquet del catàleg, resolts per `service_role`.
 *
 * S'exporta perquè el fan servir DUES cotitzacions: la compra d'un bo i l'alta
 * d'una subscripció (0072). Amb una còpia per cadascuna, el dia que canviï què
 * compta com a "servei vàlid" —avui: que existeixi i estigui actiu— una de les
 * dues es quedaria enrere sense que ho notés ningú.
 *
 * Que el paquet hagi d'estar ACTIU es comprova aquí i no a qui crida: el
 * navegador només envia un `serviceId`, i el preu i les sessions han de sortir
 * sempre del catàleg.
 *
 * AL CLIENT SE L'HI POT APUNTAR DE DUES MANERES, i per això `ClientRef`. El
 * propi client només sap el seu `profileId` —és el que porta la sessió—, mentre
 * que l'admin i el professional treballen sempre amb el `clientId` de la fitxa
 * que tenen obert. Resoldre'n un a partir de l'altre a cada cridant seria
 * escampar la mateixa consulta per mitja app; `clients.profile_id` és
 * `not null unique` des de la 0001, així que la correspondència existeix sempre
 * i en els dos sentits.
 */
export type ClientRef = { profileId: string } | { clientId: string };

export type CatalogueSelection = {
  clientId: string;
  service: {
    id: string;
    serviceType: ServiceType;
    name: string;
    price: number;
    defaultSessions: number;
    active: boolean;
    /** Casella del catàleg (0086). Vegeu `lib/subscription-rules.ts`. */
    subscriptionOnly: boolean;
  };
};

export async function loadClientAndService(
  input: ClientRef & { serviceId: string },
): Promise<CatalogueSelection> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) =>
      "clientId" in input ? c.id === input.clientId : c.profile_id === input.profileId,
    );
    if (!client) throw new Error("Client no trobat.");
    const row = store.services.find((x) => x.id === input.serviceId && x.active);
    if (!row) throw new Error("Servei no vàlid.");
    return {
      clientId: client.id,
      service: {
        id: row.id,
        serviceType: row.service_type,
        name: row.name,
        price: row.price,
        defaultSessions: row.default_sessions,
        active: row.active,
        subscriptionOnly: row.subscription_only,
      },
    };
  }

  const admin = createAdminClient();
  const byClientId = "clientId" in input;
  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id")
    .eq(byClientId ? "id" : "profile_id", byClientId ? input.clientId : input.profileId)
    .single();
  if (cErr || !client) throw new Error("Client no trobat.");

  const { data: row, error: sErr } = await admin
    .from("services")
    .select("service_type, price, default_sessions, active, name, subscription_only")
    .eq("id", input.serviceId)
    .single();
  if (sErr || !row || !row.active) throw new Error("Servei no vàlid.");

  return {
    clientId: client.id,
    service: {
      id: input.serviceId,
      serviceType: row.service_type,
      name: row.name,
      price: row.price,
      defaultSessions: row.default_sessions,
      active: row.active,
      subscriptionOnly: row.subscription_only,
    },
  };
}

export async function quoteBonoPurchase(input: {
  profileId: string;
  serviceId: string;
}): Promise<BonoPurchaseQuote> {
  const { getEffectivePrice } = await import("@/lib/data/promotions");
  const { clientId, service } = await loadClientAndService(input);

  // Un paquet marcat «només per subscripció» no es ven solt. Aquesta
  // comprovació és l'ESPILL EXACTE de la de `quoteSubscription`, que rebutja
  // tot el que NO la porti: entre les dues, cada paquet té una porta i només
  // una. Des de la 0086 es mira la casella del paquet i no el tipus de servei,
  // perquè dins d'un mateix tipus hi conviuen els dos règims.
  //
  // Va aquí i no a les dues accions perquè aquesta funció és l'embut per on
  // passen els dos camins de compra —el bo pendent de pagar i la sessió de
  // Stripe—. A la pantalla es decideix què s'ensenya; qui rep el `serviceId` és
  // el servidor i no es pot refiar del que li arribi.
  if (isSubscriptionOnly(service))
    throw new Error(PACKAGE_IS_SUBSCRIPTION_ONLY);

  // El millor descompte, i només un: l'oferta pública del catàleg o la
  // recompensa personal de referit. No es combinen.
  //
  // Amb clientId: aquest preu és el que pagarà aquest client —el veu a la
  // pantalla, i és el que Stripe cobrarà—, així que les ofertes segmentades que
  // l'abastin hi han d'entrar. És la mateixa crida que fa /client/bonos, i per
  // això dona el mateix número: si divergissin, el client veuria un preu a la
  // pantalla i un altre a la targeta.
  const ep = await getEffectivePrice(service, { clientId });
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
  /**
   * Que es renovi sol quan s'acabi (0088). Ve de la casella de la compra.
   *
   * No cal comprovar aquí que el client no tingui subscripció viva: un paquet
   * subscribible no arriba a aquesta funció —`quoteBonoPurchase` el rebutja— i
   * si algun dia arribés, la constraint `bonos_auto_renew_not_subscription`
   * només mira que el bo no vingui d'una subscripció, que aquest no en ve.
   * L'exclusivitat fina la governa l'interruptor de «Els meus bons».
   */
  autoRenew?: boolean;
}): Promise<string> {
  // La caducitat es compta des de la COMPRA, no des del pagament: un bo
  // pendent de pagar ja té la seva data des del primer moment.
  const expiresAt = await expiryForNewBono();
  const quote = await quoteBonoPurchase(input);
  const autoRenew = await autoRenewAllowed(
    quote.clientId,
    quote.serviceType,
    input.autoRenew,
  );

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
      subscription_id: null,
      subscription_cycle_start: null,
      is_subscription_extra: false,
      stripe_invoice_id: null,
      // D'on ha sortit aquest bo al catàleg (0088). Sense això no es pot
      // renovar: no sabríem quin paquet tornar a vendre.
      service_id: input.serviceId,
      auto_renew: autoRenew,
      renewed_from_bono_id: null,
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
        service_id: input.serviceId,
        auto_renew: autoRenew,
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
  /**
   * Paquet del catàleg (0088). Surt de les METADADES de la sessió, no d'una
   * consulta: el que s'ha venut s'ha de poder lliurar encara que entremig el
   * centre hagi tocat el catàleg, i és el mateix criteri que ja segueix la
   * resta de la fotografia que viatja amb la sessió.
   */
  serviceId: string | null;
  /** Que es renovi sol quan s'acabi (0088). Ve de les metadades de la sessió. */
  autoRenew?: boolean;
}): Promise<{ id: string; created: boolean }> {
  const expiresAt = await expiryForNewBono();
  // Sense paquet no es pot renovar i la constraint de la 0088 ho rebutjaria,
  // així que val més no demanar-ho que fer petar el webhook.
  const autoRenew =
    input.serviceId !== null &&
    (await autoRenewAllowed(
      input.clientId,
      input.serviceType,
      input.autoRenew,
    ));
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
      service_id: input.serviceId,
      auto_renew: autoRenew,
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
 * Quants bons té aquest client per pagar: pendents i decaiguts per impagament.
 *
 * Són els mateixos estats que pot cobrar el taulell (`COLLECTABLE`), i no és
 * casualitat: el que el client ha de veure és exactament el que algú li pot
 * cobrar. Un bo 'unpaid' hi entra tot i haver decaigut, perquè encara es pot
 * pagar i recuperar.
 *
 * Es compta sense baixar cap fila: la piloteta del menú només vol el número.
 *
 * REP EL `clientId` JA RESOLT, I NO EL PERFIL
 *
 * Abans buscava ella mateixa la fila del client a partir del perfil. Ara la hi
 * dona qui crida (`getClientBadgeCounts`), que la necessita igualment per al
 * recompte de comunitat: entre les dues es buscava dos cops el mateix.
 */
export async function countCollectableBonos(clientId: string): Promise<number> {
  if (USE_MOCK) {
    return getStore().bonos.filter(
      (b) => b.client_id === clientId && COLLECTABLE.includes(b.status),
    ).length;
  }

  const { count } = await createAdminClient()
    .from("bonos")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", COLLECTABLE);
  return count ?? 0;
}

/**
 * Quants bons de TOT el centre queden per cobrar: la cua de feina del taulell.
 *
 * És la piloteta de «Bons» al menú de l'admin i del professional. Des de la
 * 0085 qualsevol professional pot cobrar qualsevol bo, així que el número és el
 * mateix per a tots dos: el que hi ha pendent, sigui de qui sigui el client.
 *
 * AMB EL CLIENT DE SESSIÓ, NO AMB EL DE SERVEI
 *
 * És el mateix client que fa servir `listBonos`, que és d'on la taula treu el
 * número amb què després corregeix la piloteta. Comptats amb la mateixa
 * visibilitat, el número del menú i el de la taula no poden discrepar. La
 * `bonos_select` de la 0005 inclou `is_trainer()`, o sigui que el professional
 * hi veu tots els bons del centre i el recompte no es queda curt.
 *
 * ELS CADUCATS NO HI COMPTEN, ENCARA QUE LA BASE NO HO SÀPIGUI
 *
 * `listBonos` passa l'escombrat abans de llegir, i un 'pending_payment' amb la
 * data passada hi surt ja 'expired'. Aquí no s'escombra —això corre dins del
 * layout, i el layout no ha d'escriure res—, però es filtra igual: sense el
 * filtre, el primer frame comptaria un bo que la taula ja no ensenya. Els
 * 'unpaid' no caduquen (no són `USABLE`), per això passen sempre.
 */
export async function countCenterCollectableBonos(): Promise<number> {
  const today = centerToday();

  if (USE_MOCK) {
    return getStore().bonos.filter(
      (b) =>
        COLLECTABLE.includes(b.status) &&
        !isBonoExpired({ status: b.status, expires_at: b.expires_at ?? null }, today),
    ).length;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("bonos")
    .select("id", { count: "exact", head: true })
    .in("status", COLLECTABLE)
    .or(`status.eq.unpaid,expires_at.is.null,expires_at.gte.${today}`);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Per què un bo concret NO pot dur renovació automàtica. Null = sí que pot.
 *
 * Són codis i no frases: això corre al servidor i la pantalla del client es
 * llegeix en tres idiomes.
 */
export type AutoRenewBlock =
  | "notYours"
  | "noPackage"
  | "fromGift"
  | "fromSubscription"
  | "hasSubscription"
  | "notSellable";

/**
 * Activa o desactiva la renovació automàtica d'un bo.
 *
 * QUI DECIDEIX ÉS QUI PAGA
 *
 * Per això rep el `profileId` de la sessió i comprova que el bo sigui seu. No
 * hi ha cap camí equivalent per a l'admin ni per al professional, i és
 * deliberat: un compromís de despesa recurrent no l'ha de poder contraure algú
 * altre des de l'alta manual.
 *
 * LES QUATRE PORTES TANCADES
 *
 * · Sense `service_id` no se sap quin paquet tornar a vendre (bons anteriors a
 *   la 0088). La constraint `bonos_auto_renew_needs_service` ho remataria.
 * · Un bo vingut d'un VAL DE REGAL no es renova: qui el va rebre no va triar
 *   comprometre's a res, i renovar un regal a compte seu seria una sorpresa
 *   desagradable.
 * · Un bo emès per una SUBSCRIPCIÓ ja es renova sol cada mes. Ho remata la
 *   constraint `bonos_auto_renew_not_subscription`.
 * · I si el client té una subscripció VIVA d'aquest servei, tampoc: li
 *   arribarien bons per dues vies. Aquesta és la meitat de la regla que cap
 *   check de fila pot expressar, i per això es comprova aquí.
 *
 * La cinquena, que el paquet encara es pugui vendre solt, es mira en ACTIVAR
 * però no en desactivar: si el centre el retira, qui ho tingui encès ha de
 * poder apagar-ho igualment.
 */
export async function setBonoAutoRenew(input: {
  profileId: string;
  bonoId: string;
  on: boolean;
}): Promise<{ ok: true } | { ok: false; reason: AutoRenewBlock }> {
  const b = await loadOwnBono(input.profileId, input.bonoId);
  if (!b) return { ok: false, reason: "notYours" };

  if (input.on) {
    if (!b.serviceId) return { ok: false, reason: "noPackage" };
    if (b.giftVoucherId) return { ok: false, reason: "fromGift" };
    if (b.subscriptionId) return { ok: false, reason: "fromSubscription" };

    const pkg = await loadServicePackage(b.serviceId);
    if (!pkg || !pkg.active || isSubscriptionOnly(pkg))
      return { ok: false, reason: "notSellable" };

    const { getLiveSubscriptionForProfile } = await import(
      "@/lib/data/subscriptions"
    );
    if (await getLiveSubscriptionForProfile(input.profileId, b.serviceType))
      return { ok: false, reason: "hasSubscription" };
  }

  if (USE_MOCK) {
    const store = getStore();
    const row = store.bonos.find((x) => x.id === input.bonoId);
    if (!row) return { ok: false, reason: "notYours" };
    row.auto_renew = input.on;
    saveStore(store);
    return { ok: true };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bonos")
    .update({ auto_renew: input.on })
    .eq("id", input.bonoId)
    .eq("client_id", b.clientId);
  if (error) return { ok: false, reason: "notSellable" };
  return { ok: true };
}

/** El bo, només si és d'aquest perfil. */
async function loadOwnBono(
  profileId: string,
  bonoId: string,
): Promise<{
  clientId: string;
  serviceType: ServiceType;
  serviceId: string | null;
  giftVoucherId: string | null;
  subscriptionId: string | null;
} | null> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    const b = store.bonos.find((x) => x.id === bonoId);
    if (!client || !b || b.client_id !== client.id) return null;
    return {
      clientId: b.client_id,
      serviceType: b.service_type,
      serviceId: b.service_id ?? null,
      giftVoucherId: b.gift_voucher_id ?? null,
      subscriptionId: b.subscription_id ?? null,
    };
  }
  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!client) return null;
  const { data: b } = await admin
    .from("bonos")
    .select("client_id, service_type, service_id, gift_voucher_id, subscription_id")
    .eq("id", bonoId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!b) return null;
  return {
    clientId: b.client_id,
    serviceType: b.service_type,
    serviceId: b.service_id,
    giftVoucherId: b.gift_voucher_id,
    subscriptionId: b.subscription_id,
  };
}

/**
 * El bo pendent que AQUEST client pot pagar, amb el que fa falta per cobrar-lo.
 *
 * Torna null si no existeix, si no és seu o si no està per cobrar. Les tres
 * respostes es fonen en una de sola a posta: qui pregunta per un bo d'altri no
 * ha de poder distingir «no existeix» de «no és teu».
 *
 * El nom del paquet surt del catàleg si encara hi és, i si no, es construeix
 * amb el que sap el bo. No es depèn que el paquet segueixi viu: el que s'ha de
 * cobrar és el que el bo diu, no el que digui avui el catàleg.
 */
export async function getPayableBono(
  profileId: string,
  bonoId: string,
): Promise<{
  id: string;
  clientId: string;
  serviceType: ServiceType;
  totalSessions: number;
  price: number;
  packageName: string;
} | null> {
  const fallbackName = (t: ServiceType, n: number) =>
    `${SERVICE_LABELS[t]} · ${n} sessions`;

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    if (!client) return null;
    const b = store.bonos.find((x) => x.id === bonoId);
    if (!b || b.client_id !== client.id || !COLLECTABLE.includes(b.status))
      return null;
    const name =
      store.services.find((x) => x.id === b.service_id)?.name ??
      fallbackName(b.service_type, b.total_sessions);
    return {
      id: b.id,
      clientId: b.client_id,
      serviceType: b.service_type,
      totalSessions: b.total_sessions,
      price: b.price,
      packageName: name,
    };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!client) return null;

  const { data: b } = await admin
    .from("bonos")
    .select("id, client_id, service_type, total_sessions, price, status, service_id")
    .eq("id", bonoId)
    .eq("client_id", client.id)
    .in("status", COLLECTABLE)
    .maybeSingle();
  if (!b) return null;

  let name = fallbackName(b.service_type, b.total_sessions);
  if (b.service_id) {
    const { data: svc } = await admin
      .from("services")
      .select("name")
      .eq("id", b.service_id)
      .maybeSingle();
    if (svc?.name) name = svc.name;
  }

  return {
    id: b.id,
    clientId: b.client_id,
    serviceType: b.service_type,
    totalSessions: b.total_sessions,
    price: b.price,
    packageName: name,
  };
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
 * De quin client és un bo. Serveix per comprovar, abans de tocar-lo, que és
 * d'algú de qui es tenen competències.
 */
export async function getBonoClientId(bonoId: string): Promise<string | null> {
  if (USE_MOCK)
    return getStore().bonos.find((b) => b.id === bonoId)?.client_id ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("bonos")
    .select("client_id")
    .eq("id", bonoId)
    .maybeSingle();
  return data?.client_id ?? null;
}

/** Estats des dels quals un bo encara es pot cobrar. */
const COLLECTABLE: BonoStatus[] = ["pending_payment", "unpaid"];

/**
 * Cobra un bo: l'activa i anota el cobrament en efectiu. El fa l'admin (o
 * l'entrenador/a del client, des de la 0056) quan el client paga al centre.
 *
 * TAMBÉ ACCEPTA ELS 'unpaid', i no és un descuit. Un bo decau a 'unpaid' quan
 * passa el termini de la 0044 sense cobrar-se, i fins ara aquell bo ja no es
 * podia cobrar per cap pantalla: el client apareixia al centre amb els diners i
 * no hi havia on anotar-los. Amb les subscripcions això deixa de ser un cas
 * rar —un subscriptor que es retarda un mes hi cau sol— i el forat es notaria.
 *
 * El que NO torna són les reserves. Quan el bo va decaure, l'escombrat va
 * alliberar les seves sessions futures i aquelles franges ja poden ser d'algú
 * altre. El bo recupera les sessions que li quedaven; les hores, s'han de
 * tornar a demanar. La pantalla ho diu abans de cobrar.
 */
/**
 * Com s'ha cobrat el bo.
 *
 * Per defecte, en efectiu al centre: és el que feia aquesta funció des de
 * sempre i el que fan els botons d'admin i professional, que no li passen res.
 *
 * Amb targeta hi arriba des del webhook de Stripe, i llavors porta els dos
 * identificadors: el del pagament —que és el que fa el registre IDEMPOTENT, per
 * l'índex de la 0054— i el de la sessió, que es desa al bo perquè la pantalla
 * de tornada el pugui trobar.
 */
export type BonoPayment = {
  method: PaymentMethod;
  stripePaymentId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

export async function markBonoPaid(
  bonoId: string,
  payment: BonoPayment = { method: "cash" },
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const bono = store.bonos.find((b) => b.id === bonoId);
    if (!bono) throw new Error("Bo no trobat.");
    if (!COLLECTABLE.includes(bono.status))
      throw new Error("Aquest bo no es pot cobrar.");

    bono.status = "active";
    if (payment.stripeCheckoutSessionId)
      bono.stripe_checkout_session_id = payment.stripeCheckoutSessionId;
    saveStore(store);
    await recordBonoPayment(bono, payment);
    // Genera les recompenses de referit només quan el pagament es confirma.
    // És idempotent: no duplica si ja existeixen per aquest referit.
    await maybeGenerateReferralRewards(bono.client_id);
    await resumeSubscription(bonoId);
    return;
  }

  const supabase = await createClient();
  const { data: bono, error: bErr } = await supabase
    .from("bonos")
    .select("id, client_id, price, status, service_type, total_sessions")
    .eq("id", bonoId)
    .single();
  if (bErr || !bono) throw new Error("Bo no trobat.");
  if (!COLLECTABLE.includes(bono.status))
    throw new Error("Aquest bo no es pot cobrar.");

  const { error: uErr } = await supabase
    .from("bonos")
    .update({
      status: "active",
      ...(payment.stripeCheckoutSessionId
        ? { stripe_checkout_session_id: payment.stripeCheckoutSessionId }
        : {}),
    })
    .eq("id", bonoId)
    // El mateix filtre que la comprovació de sobre, però a la consulta: si dos
    // cobraments arriben alhora, només un troba el bo per cobrar.
    .in("status", COLLECTABLE);
  if (uErr) throw uErr;

  await recordBonoPayment(bono, payment);
  // Generate referral rewards if this is the first paid bono for this client
  // (maybeGenerateReferralRewards is idempotent — safe to call unconditionally)
  await maybeGenerateReferralRewards(bono.client_id);
  await resumeSubscription(bonoId);
}

/**
 * Anota el cobrament del bo, pel camí que toqui.
 *
 * Amb targeta va per `createSystemPayment`, que l'índex únic de
 * `stripe_payment_id` (0054) fa idempotent: si el webhook arriba dos cops, el
 * segon no anota res i no passa res. En efectiu, per `createPayment` de tota la
 * vida, que és el que ha fet una persona al taulell.
 */
async function recordBonoPayment(
  bono: {
    id: string;
    client_id: string;
    price: number;
    service_type: ServiceType;
    total_sessions: number;
  },
  payment: BonoPayment,
): Promise<void> {
  const common = {
    clientId: bono.client_id,
    bonoId: bono.id,
    amount: bono.price,
    concept: bonoConcept(bono.service_type, bono.total_sessions),
  };
  if (payment.method === "card")
    await createSystemPayment({
      ...common,
      method: "card",
      stripePaymentId: payment.stripePaymentId ?? null,
    });
  else await createPayment({ ...common, method: "cash" });
}

/**
 * Si el bo que s'acaba de cobrar era el mes d'una subscripció aturada, la torna
 * a posar en marxa.
 *
 * L'import dinàmic trenca un cicle: `subscriptions.ts` importa d'aquí
 * (`loadClientAndService`) i necessitem cridar-lo en sentit contrari. Mateix
 * recurs que ja fa servir `quoteBonoPurchase` amb `promotions`.
 *
 * No tomba el cobrament si falla: els diners ja estan anotats i el bo ja és
 * actiu. Que la subscripció es quedi un dia més en 'past_due' és molt menys
 * greu que desfer un pagament confirmat, i l'admin sempre la pot reactivar.
 */
async function resumeSubscription(bonoId: string): Promise<void> {
  try {
    const { resumeAfterCyclePayment } = await import("@/lib/data/subscriptions");
    await resumeAfterCyclePayment(bonoId);
  } catch (e) {
    console.error("[subscripcions] no s'ha pogut reactivar després del cobrament:", e);
  }
}

// ─── Anul·lar un bo ──────────────────────────────────────────────────────────

/**
 * Anul·la un bo: el passa a 'cancelled' i torna la recompensa de referit que
 * s'hi hagués gastat.
 *
 * NO toca el cobrament. Si el bo era actiu, els diners segueixen anotats a
 * `payments`: no hi ha cap forma de representar-hi una devolució, i inventar-ne
 * una a mitges (esborrar la fila) trencaria l'històric que la 0016 va decidir
 * conservar. El llibre dirà que es va cobrar i el bo dirà que està anul·lat,
 * que és la veritat; la devolució es fa fora de l'app.
 */
export async function cancelBono(
  bonoId: string,
  opts: { isAdmin: boolean },
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const bono = store.bonos.find((b) => b.id === bonoId);
    if (!bono) throw new Error("Bo no trobat.");
    const block = cancelBlockFor(
      {
        status: bono.status,
        remainingSessions: bono.remaining_sessions,
        totalSessions: bono.total_sessions,
        subscriptionId: bono.subscription_id,
      },
      opts.isAdmin,
    );
    if (block) throw new Error(CANCEL_BLOCK_LABELS[block]);

    bono.status = "cancelled";
    saveStore(store);
    await releaseReferralRewardOfBono(bonoId);
    return;
  }

  const supabase = await createClient();
  const { data: bono, error: bErr } = await supabase
    .from("bonos")
    .select("id, status, remaining_sessions, total_sessions, subscription_id")
    .eq("id", bonoId)
    .single();
  if (bErr || !bono) throw new Error("Bo no trobat.");

  const block = cancelBlockFor(
    {
      status: bono.status,
      remainingSessions: bono.remaining_sessions,
      totalSessions: bono.total_sessions,
      subscriptionId: bono.subscription_id,
    },
    opts.isAdmin,
  );
  if (block) throw new Error(CANCEL_BLOCK_LABELS[block]);

  const { data: updated, error: uErr } = await supabase
    .from("bonos")
    .update({ status: "cancelled" })
    .eq("id", bonoId)
    // Les mateixes condicions, però a la consulta: si entremig algú ha cobrat
    // el bo o hi ha reservat una sessió, aquesta anul·lació ja no troba res.
    // Mateix criteri que `markBonoPaid` amb el seu `.in('status', ...)`.
    .eq("status", bono.status)
    .eq("remaining_sessions", bono.total_sessions)
    .select("id");
  if (uErr) throw uErr;
  if (!updated || updated.length === 0)
    throw new Error("El bo ha canviat mentrestant. Torna-ho a mirar.");

  await releaseReferralRewardOfBono(bonoId);
}
