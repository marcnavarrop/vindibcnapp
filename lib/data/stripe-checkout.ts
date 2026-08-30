import "server-only";
import type Stripe from "stripe";
import { getStripe, siteOrigin, toCents, fromCents, STRIPE_MIN_CENTS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteBonoPurchase, createPaidBono } from "@/lib/data/bonos";
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
import { createSystemPayment } from "@/lib/data/payments";
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
