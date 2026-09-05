import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  fulfillCheckoutSession,
  fulfillSubscriptionInvoice,
  markSubscriptionCancelled,
  markSubscriptionPastDue,
  syncSubscriptionSchedule,
  type Fulfilment,
} from "@/lib/data/stripe-checkout";

/**
 * Webhook de Stripe: l'ÚNIC lloc on el que Stripe cobra es converteix en un bo,
 * un val o un mes de subscripció.
 *
 * Qui autentica aquesta petició és la signatura de Stripe, no cap sessió: per
 * això la ruta queda FORA del `matcher` del middleware, igual que `/api/cron/*`.
 * No crida `getViewer()` enlloc, així que tampoc necessita que ningú li netegi
 * les capçaleres d'identitat; si algun dia n'hagués de fer servir, hauria
 * d'entrar al matcher. El contracte és a lib/auth-headers.ts.
 */

// El cos s'ha de llegir TAL CUAL arriba per verificar la signatura: qualsevol
// reserialització (JSON.parse + stringify) la invalida. `req.text()` el dona en
// cru. `force-dynamic` perquè no se'n memoritzi res.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Els esdeveniments que escoltem, i per què cadascun.
 *
 * `checkout.session.completed` només serveix per als pagaments ÚNICS (bo i val).
 * Les subscripcions no hi passen a posta: el seu primer cobrament arriba com una
 * factura més, igual que el catorzè, i tractar-los pel mateix camí és el que fa
 * que el mes u no pugui divergir de la resta.
 *
 * `invoice.paid` i no `invoice.payment_succeeded`: el primer és el que garanteix
 * que la factura ha quedat saldada, també quan s'ha cobrat en diverses vegades.
 *
 * `customer.subscription.deleted` tanca les dues sortides que no controlem des
 * d'aquí: la baixa que el client fa al portal de Stripe i l'abandó de Stripe
 * quan es cansa de reintentar un cobrament.
 *
 * `customer.subscription.updated` hi és perquè una baixa al portal NO arriba com
 * un `deleted` sinó com un `updated` amb `cancel_at_period_end`, i el `deleted`
 * no ve fins un mes després. Sense escoltar-lo, durant tot aquell mes diríem al
 * client que se li renovarà.
 */
const HANDLERS: Record<string, (e: Stripe.Event) => Promise<Fulfilment>> = {
  "checkout.session.completed": (e) =>
    fulfillCheckoutSession(e.data.object as Stripe.Checkout.Session),
  "invoice.paid": (e) => fulfillSubscriptionInvoice(e.data.object as Stripe.Invoice),
  "invoice.payment_failed": (e) =>
    markSubscriptionPastDue(e.data.object as Stripe.Invoice),
  "customer.subscription.deleted": (e) =>
    markSubscriptionCancelled(e.data.object as Stripe.Subscription),
  // El quart, que no era al disseny: sense ell, una baixa feta al portal de
  // Stripe no es notaria aquí fins d'aquí a un mes. Veure `syncSubscriptionSchedule`.
  "customer.subscription.updated": (e) =>
    syncSubscriptionSchedule(e.data.object as Stripe.Subscription),
};

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] falta STRIPE_WEBHOOK_SECRET: no es pot verificar res.");
    return NextResponse.json({ error: "webhook no configurat" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "sense signatura" }, { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch (e) {
    // 400 i no 500 a posta: una signatura que no quadra no millorarà per molt
    // que Stripe ho reintenti, i un 500 el faria reintentar durant hores.
    console.error("[stripe] signatura no vàlida:", e);
    return NextResponse.json({ error: "signatura no vàlida" }, { status: 400 });
  }

  const handler = HANDLERS[event.type];
  if (!handler) return NextResponse.json({ received: true, ignored: event.type });

  try {
    const result = await handler(event);
    // Un duplicat respon 200: Stripe avisa que pot lliurar el mateix
    // esdeveniment més d'un cop, i respondre-li un error el faria insistir amb
    // una feina que ja està feta.
    console.log(`[stripe] ${event.id} → ${result.status}`, result);
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    // Aquí sí que interessa el reintent: els diners ja hi són i el bo encara
    // no. Un 500 fa que Stripe torni a trucar.
    console.error(`[stripe] ${event.id} ha fallat:`, e);
    return NextResponse.json({ error: "no s'ha pogut complir la compra" }, { status: 500 });
  }
}
