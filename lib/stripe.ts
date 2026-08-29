import "server-only";
import Stripe from "stripe";
import { headers } from "next/headers";
import { USE_MOCK } from "@/lib/config";

/**
 * Stripe Checkout.
 *
 * S'ha triat Checkout allotjat (la pàgina de pagament de Stripe) i no Elements:
 * les dades de la targeta no passen mai pel nostre domini, així que el
 * compliment PCI se'l menja Stripe sencer, i el flux —surts de l'app, pagues,
 * tornes— encaixa amb la resta de passos guiats de la compra.
 */

/**
 * La clau secreta. NO es llegeix a l'arrel del mòdul amb `!`: si falta, volem
 * un error clar en el moment de fer-la servir i no una excepció opaca en
 * importar el fitxer (que tombaria també les pàgines que només volen saber si
 * el botó s'ha de veure).
 */
function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY.");
  return key;
}

/**
 * ¿Es pot pagar amb targeta ara mateix?
 *
 * En simulació NO, encara que hi hagi claus: el mode mock no té Supabase, i un
 * pagament real que acaba en un magatzem en memòria és pitjor que no oferir-lo.
 * La fan servir les pàgines per decidir si ensenyen el botó, i també les
 * accions del servidor, que no es refien del que arribi del navegador.
 *
 * Exigeix TAMBÉ el secret del webhook, i això no és una comprovació de més. El
 * bo i el val només neixen quan arriba l'avís de Stripe, i aquest avís no es
 * processa sense el secret amb què se'n verifica la signatura. Amb la clau
 * secreta però sense el secret del webhook, el botó cobraria de veritat i no
 * crearia mai res: el pitjor estat possible. Val més que no aparegui.
 */
export function stripeEnabled(): boolean {
  return (
    !USE_MOCK &&
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  );
}

let cached: Stripe | null = null;

/** El client de Stripe, un per procés. */
export function getStripe(): Stripe {
  if (!cached) cached = new Stripe(secretKey());
  return cached;
}

/**
 * Import mínim que accepta Stripe en euros (50 cèntims). Un paquet a 0 € —o a
 * 0,30 € després d'un descompte molt agressiu— no es pot cobrar amb targeta, i
 * val més dir-ho que deixar que Stripe rebutgi la sessió amb el seu missatge.
 */
export const STRIPE_MIN_CENTS = 50;

/** Euros → cèntims. Els preus del catàleg són numeric(10,2). */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Cèntims → euros, per desar el que Stripe ha cobrat DE VERITAT. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * L'origen públic de l'app, per a les URL de tornada.
 *
 * Surt de la petició en curs i no d'una variable: així funciona igual en local,
 * en una preview de Vercel i en producció, sense haver de recordar posar-hi res
 * a cada entorn. `NEXT_PUBLIC_SITE_URL` només hi és per si algun dia el domini
 * públic no coincideix amb el host que arriba al servidor.
 */
export async function siteOrigin(): Promise<string> {
  const override = process.env.NEXT_PUBLIC_SITE_URL;
  if (override) return override.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("No s'ha pogut determinar l'adreça de l'app.");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
