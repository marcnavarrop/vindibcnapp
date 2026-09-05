import "server-only";
import type Stripe from "stripe";
import { getStripe, siteOrigin, toCents, fromCents, STRIPE_MIN_CENTS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteBonoPurchase, createPaidBono } from "@/lib/data/bonos";
import {
  createSubscription,
  getLiveSubscription,
  getSubscriptionByStripeId,
  issueCycleBono,
  markExtraBonoPaid,
  quoteSubscription,
  updateSubscription,
  type Subscription,
} from "@/lib/data/subscriptions";
import { centerDateStr } from "@/lib/center-time";
import {
  quoteGiftVoucher,
  createGiftVoucherFromSnapshot,
  getGiftVoucher,
  getGiftVoucherByStripeSession,
  setGiftVoucherPdfPath,
  voucherConcept,
  type GiftVoucherQuote,
} from "@/lib/data/gift-vouchers";
import { uploadGiftVoucherPdf } from "@/lib/data/gift-voucher-doc";
import { giftVoucherBuyerLocale } from "@/lib/data/gift-vouchers";
import { createSystemPayment, bonoConcept } from "@/lib/data/payments";
import { getCenterSettings } from "@/lib/data/center-settings";
import { SERVICE_LABELS } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

/**
 * Compra amb targeta: obrir la sessió de Checkout i, molt més tard, complir-la.
 *
 * La decisió que ho ordena tot: obrir la sessió NO crea res. El bo i el val
 * neixen quan Stripe diu que ha cobrat, i ho diu pel webhook. La redirecció de
 * tornada no serveix per a això —qui compra pot tancar la pestanya abans, o
 * escriure l'URL d'èxit a mà—, així que la pàgina de confirmació només mira si
 * el webhook ja ha passat: mai crea res pel seu compte.
 *
 * Conseqüència: entre el pagament i el bo hi ha un forat d'un o dos segons. La
 * pantalla de tornada l'ensenya honestament ("estem confirmant el pagament") en
 * comptes de fingir que ja està fet.
 */

// ─── Metadades ──────────────────────────────────────────────────────────────

/**
 * Què s'ha comprat, congelat en obrir la sessió.
 *
 * Viatja a `metadata` de la sessió i torna dins l'esdeveniment SIGNAT de
 * Stripe: no és una dada que el navegador pugui tocar. Hi va la fotografia
 * sencera del paquet (tipus, sessions, nom) i no només el `serviceId`, perquè
 * complir el pagament no pugui dependre que el catàleg segueixi igual: si
 * entremig el centre desactiva el servei, el que s'ha venut s'ha de poder
 * lliurar igualment.
 */
const KIND_BONO = "bono";
const KIND_VOUCHER = "gift_voucher";
const KIND_SUBSCRIPTION = "subscription";
const KIND_EXTRA = "bono_extra";

type CheckoutMetadata = Record<string, string>;

function readMeta(session: Stripe.Checkout.Session): CheckoutMetadata {
  return (session.metadata ?? {}) as CheckoutMetadata;
}

/** Stripe talla les metadades a 500 caràcters per valor. */
function meta(value: string | null | undefined, max = 500): string {
  return (value ?? "").slice(0, max);
}

// ─── Obrir la sessió ────────────────────────────────────────────────────────

export type CheckoutStart = { url: string } | { error: string };

/** Els dos camins comparteixen com es munta la sessió. */
async function createSession(opts: {
  amountEuros: number;
  productName: string;
  productDescription: string;
  metadata: CheckoutMetadata;
  successPath: string;
  cancelPath: string;
  customerEmail: string | null;
  clientReferenceId: string;
}): Promise<CheckoutStart> {
  const cents = toCents(opts.amountEuros);
  if (cents < STRIPE_MIN_CENTS)
    return {
      error:
        "Aquest import és massa petit per cobrar-lo amb targeta. Tria l'opció de pagar al centre.",
    };

  const origin = await siteOrigin();

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: cents,
            product_data: {
              name: opts.productName,
              description: opts.productDescription,
            },
          },
        },
      ],
      metadata: opts.metadata,
      // `client_reference_id` no el llegim per complir res: hi és perquè al
      // panell de Stripe es pugui lligar un cobrament amb un client sense
      // haver d'obrir les metadades.
      client_reference_id: opts.clientReferenceId,
      customer_email: opts.customerEmail ?? undefined,
      success_url: `${origin}${opts.successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${opts.cancelPath}`,
    });

    if (!session.url) return { error: "Stripe no ha retornat cap adreça de pagament." };
    return { url: session.url };
  } catch (e) {
    // El missatge de Stripe és per a nosaltres, no per a qui compra.
    console.error("[stripe] no s'ha pogut obrir la sessió:", e);
    return {
      error: "No s'ha pogut obrir la pàgina de pagament. Torna-ho a provar en un moment.",
    };
  }
}

/** Sessió de Checkout per comprar un bo. */
export async function startBonoCheckout(input: {
  profileId: string;
  serviceId: string;
  email: string | null;
}): Promise<CheckoutStart> {
  const quote = await quoteBonoPurchase({
    profileId: input.profileId,
    serviceId: input.serviceId,
  });

  return createSession({
    amountEuros: quote.finalPrice,
    productName: quote.packageName,
    productDescription: `${SERVICE_LABELS[quote.serviceType]} · ${quote.totalSessions} sessions`,
    metadata: {
      kind: KIND_BONO,
      profileId: input.profileId,
      clientId: quote.clientId,
      serviceId: input.serviceId,
      serviceType: quote.serviceType,
      totalSessions: String(quote.totalSessions),
      packageName: meta(quote.packageName, 200),
      referralRewardId: quote.referralRewardId ?? "",
    },
    successPath: "/client/bonos/confirmacio",
    cancelPath: "/client/bonos",
    customerEmail: input.email,
    clientReferenceId: quote.clientId,
  });
}

/** Sessió de Checkout per comprar un val de regal. */
export async function startGiftVoucherCheckout(input: {
  profileId: string;
  serviceId: string;
  email: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
}): Promise<CheckoutStart> {
  const quote = await quoteGiftVoucher({
    profileId: input.profileId,
    serviceId: input.serviceId,
  });

  return createSession({
    amountEuros: quote.finalPrice,
    productName: `Val de regal · ${quote.packageName}`,
    productDescription: `${SERVICE_LABELS[quote.serviceType]} · ${quote.totalSessions} sessions`,
    metadata: {
      kind: KIND_VOUCHER,
      profileId: input.profileId,
      clientId: quote.clientId,
      serviceId: quote.serviceId,
      serviceType: quote.serviceType,
      totalSessions: String(quote.totalSessions),
      packageName: meta(quote.packageName, 200),
      recipientName: meta(input.recipientName, 120),
      recipientEmail: meta(input.recipientEmail, 160),
      message: meta(input.message, 500),
    },
    successPath: "/client/regals/confirmacio",
    cancelPath: "/client/regals",
    customerEmail: input.email,
    clientReferenceId: quote.clientId,
  });
}

// ─── Subscripció amb targeta ────────────────────────────────────────────────

/**
 * Sessió de Checkout per SUBSCRIURE'S, no per comprar un cop.
 *
 * PER QUÈ `mode: 'subscription'` I NO UN COBRAMENT NOSTRE CADA MES
 *
 * Perquè avui aquí no hi ha cap targeta desada: el Checkout de pagament únic
 * que ja teníem crea un client convidat i no guarda cap mètode de pagament. Fer
 * els cobraments recurrents pel nostre compte voldria dir construir la
 * persistència del Customer, els PaymentIntents fora de sessió, l'escala de
 * reintents i el camí de tornada quan el banc demana 3DS sense el client al
 * davant... i disparar-ho tot des d'un cron que corre un cop al dia a hora
 * fixa. Stripe ja ho fa, i el seu aniversari de facturació és exactament el que
 * s'ha decidit: el dia del mes en què cadascú es va donar d'alta.
 *
 * EL PREU VA INLINE (`price_data`) i no com un Price del catàleg de Stripe.
 * Així queda congelat a l'alta amb l'oferta segmentada que tingués aquell dia,
 * que és la decisió D2, i no cal mantenir un Price per cada combinació de
 * paquet i descompte.
 *
 * LES METADADES VAN A `subscription_data` i no a la sessió. És la diferència
 * que fa que tot el que ve després funcioni: les de la sessió només viatgen amb
 * `checkout.session.completed`, mentre que les de la subscripció les porta CADA
 * factura, també la del mes catorze. Així el compliment té sempre a mà de qui
 * és i què va comprar, sense haver de recordar-ho nosaltres.
 */
export async function startSubscriptionCheckout(input: {
  profileId: string;
  serviceId: string;
  email: string | null;
}): Promise<CheckoutStart> {
  const { subscriptionsEnabled } = await getCenterSettings();
  if (!subscriptionsEnabled)
    return { error: "Les subscripcions no estan disponibles ara mateix." };

  const quote = await quoteSubscription({
    profileId: input.profileId,
    serviceId: input.serviceId,
  });

  // Primera barrera del conflicte "ja en té una". La segona, i la que de debò
  // garanteix res, és l'índex únic de la 0072 al compliment; però val més
  // aturar-ho abans de cobrar que haver de tornar els diners després.
  const existing = await getLiveSubscription(quote.clientId, quote.serviceType);
  if (existing)
    return { error: "Ja tens una subscripció activa d'aquest servei." };

  const cents = toCents(quote.unitPrice);
  if (cents < STRIPE_MIN_CENTS)
    return {
      error:
        "Aquest import és massa petit per cobrar-lo amb targeta. Tria l'opció de pagar al centre.",
    };

  const origin = await siteOrigin();
  const metadata: CheckoutMetadata = {
    kind: KIND_SUBSCRIPTION,
    profileId: input.profileId,
    clientId: quote.clientId,
    serviceId: quote.serviceId,
    serviceType: quote.serviceType,
    sessionsPerCycle: String(quote.sessionsPerCycle),
    packageName: meta(quote.packageName, 200),
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: cents,
            recurring: { interval: "month" },
            product_data: {
              name: quote.packageName,
              description: `${SERVICE_LABELS[quote.serviceType]} · ${quote.sessionsPerCycle} sessions al mes`,
            },
          },
        },
      ],
      subscription_data: { metadata },
      client_reference_id: quote.clientId,
      customer_email: input.email ?? undefined,
      success_url: `${origin}/client/bonos/confirmacio?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/client/bonos`,
    });

    if (!session.url) return { error: "Stripe no ha retornat cap adreça de pagament." };
    return { url: session.url };
  } catch (e) {
    console.error("[stripe] no s'ha pogut obrir la subscripció:", e);
    return {
      error: "No s'ha pogut obrir la pàgina de pagament. Torna-ho a provar en un moment.",
    };
  }
}

/**
 * El portal de facturació de Stripe: on el client canvia la targeta, mira els
 * rebuts i pot donar-se de baixa.
 *
 * No en fem una pantalla pròpia perquè seria pitjor: tocar dades de targeta vol
 * dir tornar a entrar en l'abast de PCI, i la baixa i el canvi de mètode ja els
 * té Stripe fets i traduïts. El que sí que és nostre és el que passa DESPRÉS —la
 * baixa arriba per webhook—, i això no canvia.
 */
export async function openBillingPortal(input: {
  stripeCustomerId: string;
  returnPath: string;
}): Promise<{ url: string } | { error: string }> {
  const origin = await siteOrigin();
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: input.stripeCustomerId,
      return_url: `${origin}${input.returnPath}`,
    });
    return { url: portal.url };
  } catch (e) {
    console.error("[stripe] no s'ha pogut obrir el portal:", e);
    return { error: "No s'ha pogut obrir la gestió de la subscripció." };
  }
}

/**
 * Sessió de Checkout per pagar una sessió extra JA RECLAMADA.
 *
 * Aquí sí que hi ha un bo abans de pagar, i és l'única compra d'aquest fitxer
 * que ho fa així. El motiu és a la 0073: el que es reclama de manera atòmica no
 * és el pagament sinó la plaça dins de la quota del mes. Si el client abandona
 * el pagament, el bo es queda pendent i el podrà pagar al centre; si esperéssim
 * al webhook, podria pagar i trobar-se sense sessió.
 */
export async function startExtraCheckout(input: {
  bonoId: string;
  clientId: string;
  serviceType: ServiceType;
  price: number;
  email: string | null;
}): Promise<CheckoutStart> {
  return createSession({
    amountEuros: input.price,
    productName: `${SERVICE_LABELS[input.serviceType]} · 1 sessió extra`,
    productDescription: "Sessió extra de la teva subscripció, al preu per sessió del teu bo.",
    metadata: {
      kind: KIND_EXTRA,
      bonoId: input.bonoId,
      clientId: input.clientId,
      serviceType: input.serviceType,
    },
    successPath: "/client/bonos/confirmacio",
    cancelPath: "/client/bonos/meus",
    customerEmail: input.email,
    clientReferenceId: input.clientId,
  });
}

// ─── Complir el pagament (només des del webhook) ────────────────────────────

export type Fulfilment =
  | { status: "created" | "duplicate"; kind: string; id: string }
  | { status: "ignored"; reason: string };

/**
 * Crea el que s'ha pagat.
 *
 * Idempotent per construcció: qui decideix si això ja s'havia fet no és cap
 * comprovació d'aquí sinó l'índex únic de `stripe_checkout_session_id` (0054).
 * Un SELECT previ deixaria el mateix forat que teníem amb l'aforament dels
 * grups, perquè Stripe pot lliurar el mateix esdeveniment dues vegades alhora.
 */
export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<Fulfilment> {
  // `payment_status` i no `status`: una sessió pot estar 'complete' amb el
  // pagament encara pendent (transferències, alguns mètodes diferits). Aquí
  // només compta que els diners hi siguin.
  if (session.payment_status !== "paid")
    return { status: "ignored", reason: `payment_status=${session.payment_status}` };

  const m = readMeta(session);
  // El que Stripe ha cobrat DE VERITAT. Mana sobre el que vam calcular.
  const paid = fromCents(session.amount_total ?? 0);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (m.kind === KIND_BONO)
    return fulfillBono(session.id, m, paid, paymentIntentId);
  if (m.kind === KIND_VOUCHER)
    return fulfillGiftVoucher(session.id, m, paid, paymentIntentId);
  if (m.kind === KIND_EXTRA)
    return fulfillExtraBono(session.id, m, paid, paymentIntentId);

  return { status: "ignored", reason: `kind=${m.kind ?? "(cap)"}` };
}

async function fulfillBono(
  sessionId: string,
  m: CheckoutMetadata,
  paid: number,
  paymentIntentId: string | null,
): Promise<Fulfilment> {
  const { id, created } = await createPaidBono({
    clientId: m.clientId,
    serviceType: m.serviceType as ServiceType,
    totalSessions: Number(m.totalSessions),
    price: paid,
    stripeCheckoutSessionId: sessionId,
    stripePaymentId: paymentIntentId,
    referralRewardId: m.referralRewardId || null,
  });

  return { status: created ? "created" : "duplicate", kind: KIND_BONO, id };
}

async function fulfillGiftVoucher(
  sessionId: string,
  m: CheckoutMetadata,
  paid: number,
  paymentIntentId: string | null,
): Promise<Fulfilment> {
  const { giftVoucherExpiryMonths } = await getCenterSettings();

  // La fotografia surt de les metadades, no del catàleg: veure
  // `createGiftVoucherFromSnapshot`.
  const snapshot: GiftVoucherQuote = {
    clientId: m.clientId,
    serviceId: m.serviceId,
    serviceType: m.serviceType as ServiceType,
    totalSessions: Number(m.totalSessions),
    packageName: m.packageName,
    finalPrice: paid,
  };

  const created = await createGiftVoucherFromSnapshot({
    snapshot,
    recipientName: m.recipientName || null,
    recipientEmail: m.recipientEmail || null,
    message: m.message || null,
    // Directe a 'active': el val ja està cobrat i és bescanviable des d'ara.
    // No passa per 'pending_payment' perquè no hi ha res que el centre hagi de
    // confirmar després.
    status: "active",
    stripeCheckoutSessionId: sessionId,
    price: paid,
    expiryMonths: giftVoucherExpiryMonths,
  });

  // Si ja hi era, es recupera per acabar la resta de passos: com amb els bons,
  // que el val existeixi no vol dir que el cobrament s'arribés a anotar.
  const voucher = created
    ? await getGiftVoucher(created.id)
    : await getGiftVoucherByStripeSession(sessionId);
  if (!voucher)
    throw new Error("El val consta creat però no s'ha pogut recuperar.");

  // Idempotent per l'índex de `stripe_payment_id` (0054).
  await createSystemPayment({
    clientId: m.clientId,
    bonoId: null,
    amount: paid,
    method: "card",
    concept: voucherConcept(snapshot.serviceType, snapshot.totalSessions, voucher.code),
    stripePaymentId: paymentIntentId,
  });

  // El PDF, exactament com a la compra al centre: es genera de seguida i, si
  // falla, el val existeix igualment i es torna a generar en descarregar-lo.
  // Per això no tomba el compliment: el val és el codi, no el document.
  // En un reintent, si el PDF ja hi era no es torna a generar.
  try {
    if (!voucher.pdfPath) {
      const path = await uploadGiftVoucherPdf({
        buyerClientId: m.clientId,
        voucherId: voucher.id,
        content: {
          locale: await giftVoucherBuyerLocale(m.clientId),
          code: voucher.code,
          packageName: voucher.packageName,
          serviceType: voucher.serviceType,
          totalSessions: voucher.totalSessions,
          expiresAt: voucher.expiresAt,
          buyerName: await buyerName(m.profileId),
          recipientName: voucher.recipientName,
          message: voucher.message,
        },
      });
      await setGiftVoucherPdfPath(voucher.id, path);
    }
  } catch (e) {
    console.error("[stripe] el val s'ha creat però el PDF no:", e);
  }

  return {
    status: created ? "created" : "duplicate",
    kind: KIND_VOUCHER,
    id: voucher.id,
  };
}

/**
 * El nom del comprador per al PDF. Al webhook no hi ha sessió de ningú, així
 * que no es pot llegir de `getViewer()` com fa la compra al centre.
 */
async function buyerName(profileId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", profileId)
    .maybeSingle();
  return data?.full_name ?? null;
}

// ─── Subscripcions: complir el que Stripe cobra ─────────────────────────────

/**
 * L'esdeveniment que mou TOT el cicle de vida d'una subscripció amb targeta és
 * `invoice.paid`, i no `checkout.session.completed`.
 *
 * El motiu és que el primer cobrament i el catorzè arriben exactament igual:
 * Stripe emet una factura també per l'alta (`billing_reason:
 * 'subscription_create'`). Amb un sol camí, el mes u no pot divergir de la
 * resta —que és la mateixa raó per la qual `issueCycleBono` és una funció sola—
 * i la regla de la casa es manté: obrir el Checkout no crea res.
 *
 * `checkout.session.completed` en mode subscripció, doncs, no cal escoltar-lo.
 */

type SubscriptionMeta = {
  clientId: string;
  serviceId: string;
  serviceType: ServiceType;
  sessionsPerCycle: number;
  packageName: string;
};

/** La subscripció de Stripe que ha generat aquesta factura. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details) return null;
  return typeof details.subscription === "string"
    ? details.subscription
    : (details.subscription?.id ?? null);
}

/**
 * Les metadades que vam posar a `subscription_data` en obrir el Checkout.
 *
 * Stripe en congela una còpia a cada factura, així que normalment ja les portem
 * a sobre. Si no hi fossin es demana la subscripció: val més una crida de més
 * que deixar una compra sense complir.
 */
async function subscriptionMeta(
  invoice: Stripe.Invoice,
  stripeSubscriptionId: string,
): Promise<SubscriptionMeta | null> {
  let raw = invoice.parent?.subscription_details?.metadata ?? null;
  if (!raw || !raw.clientId) {
    const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    raw = sub.metadata ?? null;
  }
  if (!raw || raw.kind !== KIND_SUBSCRIPTION || !raw.clientId) return null;

  return {
    clientId: raw.clientId,
    serviceId: raw.serviceId,
    serviceType: raw.serviceType as ServiceType,
    sessionsPerCycle: Number(raw.sessionsPerCycle),
    packageName: raw.packageName,
  };
}

/**
 * El període que aquesta factura ha cobrat, en DIES DEL CENTRE.
 *
 * Surt de la línia de la factura i no del nostre càlcul: amb targeta el
 * rellotge que cobra és el de Stripe, i el cicle ha de ser el que ell ha
 * facturat. Veure `issueCycleBono`.
 */
function invoicePeriod(invoice: Stripe.Invoice): { start: string; end: string } | null {
  const line = invoice.lines?.data?.[0];
  if (!line?.period) return null;
  return {
    start: centerDateStr(new Date(line.period.start * 1000)),
    end: centerDateStr(new Date(line.period.end * 1000)),
  };
}

/** El PaymentIntent d'una factura, per poder-la retornar si cal. */
async function invoicePaymentIntent(invoice: Stripe.Invoice): Promise<string | null> {
  const fromPayload = invoice.payments?.data
    ?.map((p) => p.payment?.payment_intent)
    .find(Boolean);
  if (fromPayload)
    return typeof fromPayload === "string" ? fromPayload : fromPayload.id;

  // El webhook no sempre porta la llista expandida.
  try {
    const full = await getStripe().invoices.retrieve(invoice.id!, {
      expand: ["payments.data.payment.payment_intent"],
    });
    const pi = full.payments?.data?.map((p) => p.payment?.payment_intent).find(Boolean);
    return pi ? (typeof pi === "string" ? pi : pi.id) : null;
  } catch (e) {
    console.error("[stripe] no s'ha pogut llegir el PaymentIntent de la factura:", e);
    return null;
  }
}

/**
 * Complir una factura de subscripció: emetre el mes que s'acaba de cobrar.
 *
 * Idempotent per l'índex únic de `stripe_invoice_id` (0072), com tota la resta
 * d'aquest fitxer: si l'esdeveniment arriba dos cops, el segon rebota amb un
 * 23505 que es llegeix com "això ja estava fet".
 */
export async function fulfillSubscriptionInvoice(
  invoice: Stripe.Invoice,
): Promise<Fulfilment> {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId)
    return { status: "ignored", reason: "factura sense subscripció" };

  // `amount_paid` i no `amount_due`: aquí només compta el que hi ha cobrat.
  if (invoice.amount_paid <= 0)
    return { status: "ignored", reason: `amount_paid=${invoice.amount_paid}` };

  const period = invoicePeriod(invoice);
  if (!period)
    return { status: "ignored", reason: "factura sense període" };

  const paid = fromCents(invoice.amount_paid);
  let subscription = await getSubscriptionByStripeId(stripeSubscriptionId);

  // Primera factura: encara no tenim fila. Es crea ara i no en obrir el
  // Checkout, perquè fins que Stripe no cobra no hi ha subscripció de veritat.
  if (!subscription) {
    const meta = await subscriptionMeta(invoice, stripeSubscriptionId);
    if (!meta) return { status: "ignored", reason: "sense metadades nostres" };

    const created = await createSubscriptionFromInvoice({
      meta,
      stripeSubscriptionId,
      customerId: typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null),
      unitPrice: paid,
      period,
      invoice,
    });
    if ("conflict" in created)
      return { status: "ignored", reason: created.conflict };
    subscription = created.subscription;
  }

  const bono = await issueCycleBono({
    subscription,
    cycleStart: period.start,
    cycleEnd: period.end,
    // Neix ACTIU i no pendent: els diners ja hi són.
    status: "active",
    price: paid,
    stripeInvoiceId: invoice.id,
  });

  // El cobrament s'identifica per la FACTURA i no pel PaymentIntent. Una
  // factura és un mes i només un, sempre ve informada, i així la idempotència
  // de l'índex de la 0054 no depèn que el webhook porti la llista de pagaments
  // expandida (que no sempre la porta).
  await createSystemPayment({
    clientId: subscription.clientId,
    bonoId: bono.id,
    amount: paid,
    method: "card",
    concept: bonoConcept(subscription.serviceType, subscription.sessionsPerCycle),
    stripePaymentId: invoice.id ?? null,
  });

  // Un cobrament que arriba després d'un impagament la torna a posar en marxa,
  // i el cicle avança sempre al que Stripe acaba de facturar.
  await updateSubscription(subscription.id, {
    status: "active",
    currentCycleStart: period.start,
    nextRenewalOn: period.end,
  });

  return {
    status: bono.created ? "created" : "duplicate",
    kind: KIND_SUBSCRIPTION,
    id: subscription.id,
  };
}

/**
 * L'alta a partir de la primera factura, amb el conflicte resolt.
 *
 * EL CONFLICTE: el client ja té una subscripció viva d'aquest servei i n'acaba
 * de pagar una altra amb targeta. L'índex `subscriptions_one_live_per_client`
 * (0072) no deixa crear la segona, i els diners ja són a casa.
 *
 * Es fa amb doble barrera —la pantalla no ofereix el botó i
 * `startSubscriptionCheckout` s'hi torna a negar— però queda una escletxa real:
 * entre obrir el Checkout i pagar, el client (o l'admin) pot donar-ne d'alta una
 * al centre. La cursa és petita i les conseqüències no: cal decidir-la.
 *
 * ES CANCEL·LA A STRIPE I ES RETORNEN ELS DINERS. Les altres dues sortides són
 * pitjors:
 *
 *   · Enganxar-la a la fila que ja hi ha vol dir que aquella persona es quedi
 *     amb un preu i un dia de renovació que no són els que li havíem promès, i
 *     amb el cicle nostre i el de Stripe dient coses diferents. És exactament el
 *     problema dels dos rellotges que aquest disseny evita a tot arreu.
 *
 *   · Respondre un error perquè Stripe reintenti no arregla res: el conflicte és
 *     un estat permanent nostre, no una fallada passatgera. Stripe insistiria
 *     hores, es rendiria, i quedaria una subscripció seva viva cobrant cada mes
 *     sense cap fila aquí. És el pitjor final possible.
 *
 * Cobrar dues vegades pel mateix dret no és defensable, i tornar-ho és l'única
 * sortida que deixa les dues parts com estaven. Es respon 200 perquè Stripe no
 * hi torni, i es deixa constància ben visible al registre.
 */
async function createSubscriptionFromInvoice(input: {
  meta: SubscriptionMeta;
  stripeSubscriptionId: string;
  customerId: string | null;
  unitPrice: number;
  period: { start: string; end: string };
  invoice: Stripe.Invoice;
}): Promise<{ subscription: Subscription } | { conflict: string }> {
  const { meta, period } = input;

  try {
    const subscription = await createSubscription({
      quote: {
        clientId: meta.clientId,
        serviceId: meta.serviceId,
        serviceType: meta.serviceType,
        sessionsPerCycle: meta.sessionsPerCycle,
        packageName: meta.packageName,
        unitPrice: input.unitPrice,
      },
      paymentMethod: "card",
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      // El cicle el marca Stripe des del primer dia.
      startedOn: period.start,
    });

    // `createSubscription` fixa la propera renovació amb la nostra aritmètica.
    // Amb targeta mana la de Stripe, així que se sobreescriu de seguida.
    await updateSubscription(subscription.id, { nextRenewalOn: period.end });
    return { subscription: { ...subscription, nextRenewalOn: period.end } };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== "23505") throw e;

    await refundConflictingSubscription(input.stripeSubscriptionId, input.invoice);
    return {
      conflict: `el client ${meta.clientId} ja tenia una subscripció viva; s'ha cancel·lat i retornat`,
    };
  }
}

async function refundConflictingSubscription(
  stripeSubscriptionId: string,
  invoice: Stripe.Invoice,
): Promise<void> {
  console.error(
    `[stripe] CONFLICTE de subscripció ${stripeSubscriptionId}: es cancel·la i es retorna la factura ${invoice.id}.`,
  );

  try {
    await getStripe().subscriptions.cancel(stripeSubscriptionId);
  } catch (e) {
    // Ja podria estar cancel·lada per un lliurament anterior del mateix
    // esdeveniment: no és motiu per no intentar el retorn.
    console.error("[stripe] no s'ha pogut cancel·lar la subscripció en conflicte:", e);
  }

  const paymentIntent = await invoicePaymentIntent(invoice);
  if (!paymentIntent) {
    console.error(
      `[stripe] ATENCIÓ: la factura ${invoice.id} no té PaymentIntent; el retorn s'ha de fer a mà des del panell.`,
    );
    return;
  }

  try {
    // La clau d'idempotència és la factura: si l'esdeveniment arriba dos cops,
    // Stripe reconeix el segon intent com el mateix i no retorna res dues
    // vegades. Aquí no ens val cap índex nostre: els diners són a la seva banda.
    await getStripe().refunds.create(
      { payment_intent: paymentIntent, reason: "duplicate" },
      { idempotencyKey: `refund-conflict-${invoice.id}` },
    );
  } catch (e) {
    console.error(
      `[stripe] ATENCIÓ: no s'ha pogut retornar la factura ${invoice.id}; cal fer-ho a mà.`,
      e,
    );
  }
}

/**
 * Un cobrament que falla atura la subscripció, igual que un mes sense cobrar al
 * centre. No es cancel·la: Stripe encara la pot rescatar amb els seus reintents,
 * i si ho aconsegueix, `invoice.paid` la tornarà a posar en marxa sola.
 */
export async function markSubscriptionPastDue(
  invoice: Stripe.Invoice,
): Promise<Fulfilment> {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId)
    return { status: "ignored", reason: "factura sense subscripció" };

  const subscription = await getSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription) return { status: "ignored", reason: "subscripció desconeguda" };
  if (subscription.status === "cancelled")
    return { status: "ignored", reason: "ja cancel·lada" };

  await updateSubscription(subscription.id, { status: "past_due" });
  return { status: "created", kind: KIND_SUBSCRIPTION, id: subscription.id };
}

/**
 * Baixa definitiva: la dona per closa aquí també.
 *
 * Arriba tant si el client s'ha donat de baixa des del portal com si Stripe l'ha
 * abandonada després d'esgotar els reintents. Les sessions del mes ja pagat NO
 * es toquen: el seu bo té la seva pròpia data i s'acaba quan li toca.
 */
export async function markSubscriptionCancelled(
  stripeSubscription: Stripe.Subscription,
): Promise<Fulfilment> {
  const subscription = await getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) return { status: "ignored", reason: "subscripció desconeguda" };
  if (subscription.status === "cancelled")
    return { status: "duplicate", kind: KIND_SUBSCRIPTION, id: subscription.id };

  await updateSubscription(subscription.id, {
    status: "cancelled",
    nextRenewalOn: null,
    cancelledAt: new Date().toISOString(),
  });
  return { status: "created", kind: KIND_SUBSCRIPTION, id: subscription.id };
}

/**
 * Sincronitza la baixa programada des de Stripe.
 *
 * Aquest quart esdeveniment no estava al disseny i hi ha entrat perquè el
 * portal de facturació obre un forat real: quan el client s'hi dona de baixa,
 * Stripe NO emet `customer.subscription.deleted` sinó `updated` amb
 * `cancel_at_period_end: true`, i el `deleted` no arriba fins que s'acaba el
 * període. Sense escoltar-ho, la nostra pantalla li seguiria dient "es renova el
 * dia X" durant un mes sencer després d'haver-se donat de baixa. Un mes
 * ensenyant una cosa falsa sobre els seus diners val més que un `case` de més.
 *
 * Només es mira `cancel_at_period_end`. L'estat de Stripe no es copia: qui
 * decideix que una subscripció està aturada per impagament és `invoice.payment_
 * failed`, i qui la tanca és `deleted`. Dos camins escrivint el mateix camp és
 * com es fabrica una incoherència.
 */
export async function syncSubscriptionSchedule(
  stripeSubscription: Stripe.Subscription,
): Promise<Fulfilment> {
  const subscription = await getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) return { status: "ignored", reason: "subscripció desconeguda" };

  const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end === true;
  if (subscription.cancelAtPeriodEnd === cancelAtPeriodEnd)
    return { status: "duplicate", kind: KIND_SUBSCRIPTION, id: subscription.id };

  await updateSubscription(subscription.id, { cancelAtPeriodEnd });
  return { status: "created", kind: KIND_SUBSCRIPTION, id: subscription.id };
}

/**
 * Programa la baixa a Stripe. La fila nostra la marca qui crida: aquí només es
 * parla amb Stripe, que és qui ha de deixar de cobrar.
 */
export async function scheduleStripeCancellation(
  stripeSubscriptionId: string,
): Promise<void> {
  await getStripe().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Cobrar la sessió extra: el bo ja existia, aquí només passa a actiu.
 *
 * L'anotació del cobrament va FORA del `if`: encara que el bo ja no es pogués
 * activar (perquè un lliurament anterior ja ho va fer, o perquè el termini de la
 * 0044 el va fer decaure entremig), els diners hi són i han de constar. És
 * idempotent per l'índex de `stripe_payment_id` de la 0054.
 */
async function fulfillExtraBono(
  sessionId: string,
  m: CheckoutMetadata,
  paid: number,
  paymentIntentId: string | null,
): Promise<Fulfilment> {
  const result = await markExtraBonoPaid({
    bonoId: m.bonoId,
    stripeCheckoutSessionId: sessionId,
    price: paid,
    stripePaymentId: paymentIntentId,
  });
  if (!result) return { status: "ignored", reason: `bo extra ${m.bonoId} no trobat` };

  await createSystemPayment({
    clientId: result.clientId,
    bonoId: m.bonoId,
    amount: paid,
    method: "card",
    concept: bonoConcept(result.serviceType, 1),
    stripePaymentId: paymentIntentId,
  });

  return {
    status: result.activated ? "created" : "duplicate",
    kind: KIND_EXTRA,
    id: m.bonoId,
  };
}
