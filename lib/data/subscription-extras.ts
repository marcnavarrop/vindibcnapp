import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";
import {
  getCycleState,
  getLiveSubscriptionForProfile,
  type CycleState,
} from "@/lib/data/subscriptions";
import type { SubscriptionExtraResult } from "@/types/database";

/**
 * La sessió extra: la novena d'un mes de vuit, al preu per sessió del bo base i
 * no al d'una sessió solta.
 *
 * PER QUÈ UN BO A PART I NO AMPLIAR EL DEL MES
 *
 * Perquè així no cal tocar res del que ja funciona. El consum és FIFO, i el bo
 * base és més antic que l'extra, de manera que l'ordre correcte surt sol: primer
 * s'esgota el mes i només després es gasta l'extra. La caducitat, l'escombrat de
 * la 0044, el pany de l'aforament dels grups i `payments` no s'assabenten que hi
 * ha res nou.
 *
 * QUI DECIDEIX SI ES POT
 *
 * La funció `claim_subscription_extra` de la 0073, dins d'un advisory lock per
 * subscripció. Comprovar aquí i inserir després seria la mateixa cursa que la
 * 0053 va treure de l'aforament: entre el recompte i l'INSERT no hi ha res.
 *
 * Aquest mòdul només hi posa el que la base no pot saber: de qui és la
 * subscripció, quant val una sessió d'aquest mes i quin dia és avui al centre.
 */

export type ExtraClaim =
  | { ok: true; bonoId: string; price: number; used: number }
  | { ok: false; reason: ExtraRefusal };

/**
 * Per què no es pot. Són codis i no frases: això corre al servidor i no sap en
 * quin idioma llegeix qui ho ha demanat.
 */
export type ExtraRefusal =
  | "noSubscription"
  | "notActive"
  | "disabled"
  | "noCycleBono"
  | "sessionsLeft"
  | "limitReached"
  | "staleCycle"
  | "failed";

/** Les raons de la 0073, traduïdes a les nostres. */
function refusalOf(reason: string): ExtraRefusal {
  switch (reason) {
    case "not_active":
      return "notActive";
    case "sessions_left":
      return "sessionsLeft";
    case "limit_reached":
      return "limitReached";
    case "stale_cycle":
      return "staleCycle";
    default:
      return "failed";
  }
}

/**
 * Demana una sessió extra per al client que hi ha a la sessió.
 *
 * El bo neix 'pending_payment' sempre, també quan es pagarà amb targeta. És
 * l'excepció documentada a la 0073: el que s'ha de reclamar de manera atòmica no
 * és el pagament sinó la PLAÇA dins de la quota del mes. Si esperéssim al
 * webhook, el client podria pagar i trobar-se que entremig se li ha exhaurit el
 * límit —diners cobrats i cap sessió—, i el pitjor cas d'aquesta manera és
 * només un bo pendent que ningú paga.
 */
export async function claimExtraSession(input: {
  profileId: string;
}): Promise<ExtraClaim> {
  const subscription = await getLiveSubscriptionForProfile(input.profileId);
  if (!subscription) return { ok: false, reason: "noSubscription" };

  const today = centerToday();
  const state = await getCycleState(subscription, today);

  // Es mira abans de trucar a la base per poder donar un motiu concret: la
  // funció de la 0073 tornaria el mateix però sense distingir "el centre no en
  // permet cap" de "ja te'l vas gastar". Qui MANA segueix sent ella.
  const early = earlyRefusal(state);
  if (early) return { ok: false, reason: early };

  const cycleBono = state.cycleBono!;
  const expiresAt = cycleBono.expiresAt;
  if (!expiresAt) return { ok: false, reason: "noCycleBono" };

  const args = {
    p_subscription_id: subscription.id,
    p_cycle_start: subscription.currentCycleStart,
    p_today: today,
    p_max_extras: state.extrasMax,
    p_price: state.pricePerSession,
    p_expires_at: expiresAt,
  };

  const result = USE_MOCK
    ? claimInMock(args)
    : await claimInDatabase(args);

  if (!result.ok) return { ok: false, reason: refusalOf(result.reason) };
  return {
    ok: true,
    bonoId: result.id,
    price: state.pricePerSession,
    used: result.used,
  };
}

/** Els motius que podem explicar millor que la base. */
function earlyRefusal(state: CycleState): ExtraRefusal | null {
  if (state.extrasMax <= 0) return "disabled";
  if (state.subscription.status !== "active") return "notActive";
  if (!state.cycleBono) return "noCycleBono";
  if (state.sessionsLeft > 0) return "sessionsLeft";
  if (state.extrasUsed >= state.extrasMax) return "limitReached";
  return null;
}

type ClaimArgs = {
  p_subscription_id: string;
  p_cycle_start: string;
  p_today: string;
  p_max_extras: number;
  p_price: number;
  p_expires_at: string;
};

async function claimInDatabase(args: ClaimArgs): Promise<SubscriptionExtraResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_subscription_extra", args);
  if (error || !data) {
    console.error("[subscripcions] claim_subscription_extra ha fallat:", error);
    return { ok: false, reason: "not_found" };
  }
  return data;
}

/**
 * El mateix, al magatzem en memòria.
 *
 * NO és la mateixa garantia —al mock no hi ha cap pany, ni concurrència que
 * valgui la pena témer— però sí el mateix comportament, perquè les pantalles es
 * puguin desenvolupar sense Supabase. Les comprovacions van en el mateix ordre
 * que la 0073 a posta: si algun dia divergissin, es notaria aquí primer.
 */
function claimInMock(args: ClaimArgs): SubscriptionExtraResult {
  const store = getStore();
  const sub = store.subscriptions.find((s) => s.id === args.p_subscription_id);
  if (!sub) return { ok: false, reason: "not_found" };
  if (sub.status !== "active") return { ok: false, reason: "not_active" };
  if (sub.current_cycle_start !== args.p_cycle_start)
    return { ok: false, reason: "stale_cycle" };

  const ofCycle = store.bonos.filter(
    (b) =>
      b.subscription_id === args.p_subscription_id &&
      b.subscription_cycle_start === args.p_cycle_start,
  );

  const left = ofCycle
    .filter(
      (b) =>
        (b.status === "active" || b.status === "pending_payment") &&
        (b.expires_at === null || b.expires_at >= args.p_today),
    )
    .reduce((n, b) => n + b.remaining_sessions, 0);
  if (left > 0) return { ok: false, reason: "sessions_left", remaining: left };

  const used = ofCycle.filter(
    (b) =>
      b.is_subscription_extra &&
      b.status !== "cancelled" &&
      b.status !== "unpaid",
  ).length;
  if (used >= args.p_max_extras)
    return { ok: false, reason: "limit_reached" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  store.bonos.push({
    id,
    client_id: sub.client_id,
    service_type: sub.service_type,
    total_sessions: 1,
    remaining_sessions: 1,
    price: args.p_price,
    status: "pending_payment",
    purchased_at: now,
    expires_at: args.p_expires_at,
    first_reservation_at: null,
    gift_voucher_id: null,
    stripe_checkout_session_id: null,
    subscription_id: sub.id,
    subscription_cycle_start: args.p_cycle_start,
    is_subscription_extra: true,
    stripe_invoice_id: null,
    created_at: now,
  });
  saveStore(store);
  return { ok: true, id, used: used + 1 };
}
