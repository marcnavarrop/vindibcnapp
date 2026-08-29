import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/data/stripe-checkout";

/**
 * Webhook de Stripe: l'ÚNIC lloc on una compra amb targeta es converteix en un
 * bo o en un val.
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

  if (event.type !== "checkout.session.completed")
    return NextResponse.json({ received: true, ignored: event.type });

  try {
    const result = await fulfillCheckoutSession(
      event.data.object as Stripe.Checkout.Session,
    );
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
