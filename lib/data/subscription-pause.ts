import "server-only";
import { centerDateStr, centerToday } from "@/lib/center-time";
import { addDays, anchorDayFor, daysBetween } from "@/lib/subscription-cycle";
import {
  getCycleBono,
  getSubscription,
  updateSubscription,
  type Subscription,
} from "@/lib/data/subscriptions";
import {
  notifySubscriptionPaused,
  notifySubscriptionResumed,
} from "@/lib/data/subscription-notify";

/**
 * Congelar i descongelar una subscripció. Decisió del CENTRE, mai del client.
 *
 * QUÈ VOL DIR CONGELAR, EXACTAMENT
 *
 * Que el rellotge s'atura. No es cobra, no s'emet el bo de cap mes nou, no hi ha
 * compte enrere i no es poden demanar sessions extra. I quan es reprèn, tot
 * torna on era: la renovació es retarda EXACTAMENT els dies que ha estat
 * aturada, i la caducitat del bo del mes en curs es desplaça els mateixos. Sense
 * aquesta segona part la congelació no seria neutral: el client hauria perdut
 * sessions ja pagades pel simple fet que el centre va decidir aturar-li-ho.
 *
 * COM ES CONGELA A STRIPE, I PER QUÈ AIXÍ
 *
 * Amb `trial_end`. Les altres dues vies no serveixen:
 *
 *   · `pause_collection` deixa la subscripció 'active' i —ho diu la
 *     documentació— SEGUEIX generant factures. Atura els diners però no el
 *     rellotge, o sigui que al reprendre Stripe seguiria al calendari vell.
 *   · El `pause` natiu de Stripe fa just el que volem, però demana una versió
 *     d'API *preview*, el flexible billing mode, i ni tan sols existeix al SDK
 *     que tenim (v22: cancel, update, resume, migrate — pause no). Posar una
 *     API preview al camí dels diners d'un centre en producció no compensa.
 *
 * `trial_end` accepta un instant qualsevol i mou l'ancoratge de facturació a
 * aquell instant: durant el "trial" Stripe no genera cap factura ni cobra res.
 * És l'única manera en API estable de dir "la propera factura, exactament aquest
 * dia", que és el que la nostra aritmètica necessita.
 *
 * El preu d'aquesta tria: Stripe posarà la subscripció en 'trialing', no en
 * 'paused'. Tant se val —la nostra taula és la font de veritat i Stripe només hi
 * posa els diners— però obliga a blindar el webhook, que és el que fa
 * `fulfillSubscriptionInvoice`.
 *
 * I un límit dur: `trial_end` admet com a molt DOS ANYS. Per això una pausa amb
 * targeta exigeix data de represa (constraint de la 0076): una d'indefinida
 * seria un cobrament que torna sol d'aquí a dos anys.
 */

export type PauseResult = { ok: true } | { ok: false; reason: PauseRefusal };
export type PauseRefusal =
  | "notFound"
  | "notActive"
  | "alreadyPaused"
  | "cardNeedsResumeDate"
  | "resumeDateInPast"
  | "stripeFailed";

/**
 * Congela una subscripció.
 *
 * NO es pot congelar una 'past_due': un mes a deure es cobra o es cancel·la.
 * Congelar-lo esborraria el rastre de l'impagament i deixaria el deute surant
 * sense cap estat que el digui. El check de la 0076 no ho pot garantir —mira
 * l'estat d'ara, no el d'abans— i per això es tanca aquí.
 */
export async function pauseSubscription(input: {
  subscriptionId: string;
  /** Dia previst de represa. Null = indefinida (només si es paga al centre). */
  resumeOn: string | null;
  today?: string;
}): Promise<PauseResult> {
  const today = input.today ?? centerToday();
  const sub = await getSubscription(input.subscriptionId);
  if (!sub) return { ok: false, reason: "notFound" };
  if (sub.status === "paused") return { ok: false, reason: "alreadyPaused" };
  if (sub.status !== "active") return { ok: false, reason: "notActive" };

  if (input.resumeOn && input.resumeOn <= today)
    return { ok: false, reason: "resumeDateInPast" };
  if (sub.paymentMethod === "card" && !input.resumeOn)
    return { ok: false, reason: "cardNeedsResumeDate" };

  // Stripe PRIMER. Si l'aturada del cobrament falla, val més no haver tocat res
  // nostre: una fila que diu 'paused' mentre el banc segueix cobrant cada mes és
  // molt pitjor que una pausa que no s'ha aplicat i es pot tornar a provar.
  if (sub.paymentMethod === "card" && sub.stripeSubscriptionId) {
    const ok = await freezeAtStripe(sub.stripeSubscriptionId, input.resumeOn!);
    if (!ok) return { ok: false, reason: "stripeFailed" };
  }

  const pausedAt = new Date().toISOString();
  await updateSubscription(sub.id, {
    status: "paused",
    pausedAt,
    resumeOn: input.resumeOn,
  });

  await notifySubscriptionPaused(sub, pausedAt, input.resumeOn);
  return { ok: true };
}

export type ResumeResult =
  | { ok: true; daysPaused: number; nextRenewalOn: string }
  | { ok: false; reason: "notFound" | "notPaused" | "noPausedAt" | "noRenewalDate" | "stripeFailed" };

/**
 * Descongela una subscripció i li torna el temps que li havia pres.
 *
 * L'aritmètica, tota junta:
 *
 *   dies              = dia(avui) − dia(paused_at)
 *   next_renewal_on   += dies
 *   anchor_day         = dia del mes de la nova data
 *   bo del cicle: expires_at += dies
 *
 * L'ancoratge canvia a posta. Si la renovació passa del 6 al 26, les següents
 * han d'anar al 26: deixar-lo al 6 faria que el mes vinent es cobrés als deu
 * dies, que és exactament el temps que acabàvem de retornar-li.
 *
 * LÍMIT CONEGUT: UNA PAUSA MÉS LLARGA QUE UN CICLE SENCER
 *
 * El que es retorna és el TEMPS, no les sessions. Si la congelació dura més que
 * el cicle que hi havia obert, la caducitat desplaçada pot seguir caient al
 * passat, i el barrido de caducitats tornarà a tancar aquell bo: el mes que va
 * quedar a mig fer no es recupera, només la data de la propera renovació.
 *
 * Es deixa així a consciència. Aquell mes ja va passar, i re-emetre'l voldria
 * dir regalar sessions que ningú ha tornat a pagar —o cobrar-les una segona
 * vegada—, i cap de les dues coses la pot decidir el codi tot sol. És un cas
 * rar (una pausa de mesos sobre un cicle mensual) i té sortida manual: l'admin
 * pot emetre un bo o allargar-ne la caducitat des del panell.
 */
export async function resumeSubscription(input: {
  subscriptionId: string;
  today?: string;
}): Promise<ResumeResult> {
  const today = input.today ?? centerToday();
  const sub = await getSubscription(input.subscriptionId);
  if (!sub) return { ok: false, reason: "notFound" };
  if (sub.status !== "paused") return { ok: false, reason: "notPaused" };
  if (!sub.pausedAt) return { ok: false, reason: "noPausedAt" };
  if (!sub.nextRenewalOn) return { ok: false, reason: "noRenewalDate" };

  // Dies SENCERS del centre. Comptar-ho en hores donaria 19 o 21 segons a quina
  // hora del dia es va congelar, i el client no ho entendria mai.
  const daysPaused = Math.max(0, daysBetween(centerDateStr(new Date(sub.pausedAt)), today));
  const nextRenewalOn = addDays(sub.nextRenewalOn, daysPaused);
  const anchorDay = anchorDayFor(nextRenewalOn);

  if (sub.paymentMethod === "card" && sub.stripeSubscriptionId) {
    const ok = await freezeAtStripe(sub.stripeSubscriptionId, nextRenewalOn);
    if (!ok) return { ok: false, reason: "stripeFailed" };
  }

  await updateSubscription(sub.id, {
    status: "active",
    pausedAt: null,
    resumeOn: null,
    nextRenewalOn,
    anchorDay,
  });

  // El bo del mes en curs també havia quedat aturat: si no se li desplaça la
  // caducitat, el client perd sessions ja pagades pel temps que el centre va
  // decidir congelar-li-ho.
  await shiftCycleBonoExpiry(sub, daysPaused);

  await notifySubscriptionResumed(sub, today, nextRenewalOn);
  return { ok: true, daysPaused, nextRenewalOn };
}

/**
 * Les que tenien data de represa i ja els toca. Les crida el cron diari.
 *
 * Una pausa indefinida (`resume_on` null) no hi entra mai: aquella només la
 * desperta l'admin a mà, que és el que vol dir indefinida.
 */
export async function resumeDueSubscriptions(
  today: string = centerToday(),
): Promise<{ resumed: number; failed: number }> {
  const { listSubscriptionsDueForResume } = await import("@/lib/data/subscriptions");
  const due = await listSubscriptionsDueForResume(today);
  let resumed = 0;
  let failed = 0;

  for (const sub of due) {
    try {
      const r = await resumeSubscription({ subscriptionId: sub.id, today });
      if (r.ok) resumed++;
      else {
        console.error(`[subscripcions] ${sub.id} no s'ha pogut reprendre: ${r.reason}`);
        failed++;
      }
    } catch (e) {
      console.error(`[subscripcions] ${sub.id} ha petat en reprendre's:`, e);
      failed++;
    }
  }
  return { resumed, failed };
}

// ─── Peces ──────────────────────────────────────────────────────────────────

/**
 * Mou la propera facturació de Stripe a un dia concret, sense cobrar res
 * entremig. Veure la capçalera del fitxer.
 *
 * `proration_behavior: 'none'` perquè aquí no s'està canviant de preu ni de pla:
 * només s'està movent la data. Sense això Stripe generaria línies de prorrateig
 * per un canvi que no és cap canvi.
 */
async function freezeAtStripe(
  stripeSubscriptionId: string,
  untilDay: string,
): Promise<boolean> {
  try {
    const { getStripe } = await import("@/lib/stripe");
    const { centerLocalToInstant } = await import("@/lib/center-time");
    // Mitjanit del centre del dia indicat: la facturació ha de caure el dia que
    // se li ha dit al client, no el que surti de convertir una data a UTC.
    const at = centerLocalToInstant(untilDay, "00:00");
    await getStripe().subscriptions.update(stripeSubscriptionId, {
      trial_end: Math.floor(at.getTime() / 1000),
      proration_behavior: "none",
    });
    return true;
  } catch (e) {
    console.error("[stripe] no s'ha pogut moure la facturació:", e);
    return false;
  }
}

/**
 * Desplaça la caducitat del bo del mes en curs els mateixos dies.
 *
 * Amb una pausa curta això li retorna el mes sencer. Amb una de més llarga que
 * el cicle, la data nova pot seguir sent passada i el bo es quedarà caducat:
 * veure el límit conegut a `resumeSubscription`.
 */
async function shiftCycleBonoExpiry(
  sub: Subscription,
  days: number,
): Promise<void> {
  if (days <= 0) return;
  try {
    const bono = await getCycleBono(sub.id, sub.currentCycleStart);
    if (!bono?.expiresAt) return;
    const { shiftBonoExpiry } = await import("@/lib/data/subscriptions");
    await shiftBonoExpiry(bono.id, addDays(bono.expiresAt, days));
  } catch (e) {
    // No tomba la represa: la subscripció ja torna a estar en marxa i això és
    // el gruix. Que la caducitat es quedi curta és un disgust que l'admin pot
    // arreglar; deixar-la pausada per això seria pitjor.
    console.error(`[subscripcions] ${sub.id}: la caducitat del bo no s'ha mogut:`, e);
  }
}
