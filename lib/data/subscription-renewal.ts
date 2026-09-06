import "server-only";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerToday } from "@/lib/center-time";
import { renewalAfter } from "@/lib/subscription-cycle";
import { extendSeriesForSubscription } from "@/lib/data/series-extension";
import {
  notifySubscriptionCancelled,
  notifySubscriptionPaymentFailed,
  notifySubscriptionRenewed,
} from "@/lib/data/subscription-notify";
import { cycleExpiry } from "@/lib/subscription-cycle";
import {
  createSubscription,
  getCycleBono,
  getLiveSubscription,
  isCycleSettled,
  issueCycleBono,
  listSubscriptionsDueForRenewal,
  quoteSubscription,
  updateSubscription,
  type Subscription,
} from "@/lib/data/subscriptions";

/**
 * Alta i renovació de les subscripcions que es paguen AL CENTRE.
 *
 * Les de targeta no passen per aquí: les mou Stripe amb el seu propi cicle de
 * facturació i el webhook (bloc 3). Barrejar-les seria demanar que dos rellotges
 * diferents decidissin el mateix mes.
 */

// ─── Alta ────────────────────────────────────────────────────────────────────

/**
 * Dona d'alta una subscripció que es pagarà al centre, amb el bo del primer mes
 * ja emès.
 *
 * El bo neix 'pending_payment' i, com qualsevol altre pendent, ja es pot fer
 * servir per reservar de seguida: és la decisió que va prendre la 0044 i que
 * aquí no canvia. Si el pagament no arriba, el mateix escombrat de sempre li
 * alliberarà les franges.
 *
 * L'interruptor del centre es mira AQUÍ i no només a la pantalla: que el botó
 * no es vegi no impedeix cridar l'acció directament.
 */
export async function subscribeAtCenter(input: {
  profileId: string;
  serviceId: string;
}): Promise<{ subscriptionId: string; bonoId: string }> {
  const { subscriptionsEnabled } = await getCenterSettings();
  if (!subscriptionsEnabled)
    throw new Error("Les subscripcions no estan disponibles ara mateix.");

  const quote = await quoteSubscription(input);

  // Comprovació amable abans de xocar amb l'índex únic de la 0072. La garantia
  // segueix sent l'índex —això és una cursa i aquí no hi ha cap pany—, però un
  // missatge entenedor val més que un 23505 a la cara del client.
  const existing = await getLiveSubscription(quote.clientId, quote.serviceType);
  if (existing) throw new Error("Ja tens una subscripció activa d'aquest servei.");

  const subscription = await createSubscription({ quote, paymentMethod: "cash" });
  const bono = await issueCycleBono({
    subscription,
    cycleStart: subscription.currentCycleStart,
    status: "pending_payment",
  });

  return { subscriptionId: subscription.id, bonoId: bono.id };
}

// ─── Renovació ───────────────────────────────────────────────────────────────

export type RenewalOutcome =
  | {
      kind: "renewed";
      subscriptionId: string;
      clientId: string;
      bonoId: string;
      cycleStart: string;
      /** Sessions que l'extensió automàtica ha col·locat, si n'hi havia cap. */
      seriesExtended: { created: number; waitlisted: number; failed: number };
    }
  | { kind: "paused"; subscriptionId: string; clientId: string }
  | { kind: "cancelled"; subscriptionId: string; clientId: string }
  | { kind: "failed"; subscriptionId: string; error: string };

/**
 * Renova les subscripcions al centre a què els toca avui (o abans).
 *
 * S'enganxa al cron diari que ja existeix. El pla gratuït de Vercel només en
 * permet un al dia, i per a una renovació mensual la resolució d'un dia és
 * exactament la que cal.
 *
 * LES TRES DECISIONS D'AQUEST BARRIDO
 *
 * 1. NO ES RENOVA SI EL MES ANTERIOR NO S'HA COBRAT. És el fre que substitueix
 *    qualsevol termini nou: el que decideix si la subscripció segueix viva és la
 *    pròpia data de renovació. Passa a 'past_due' i s'hi queda fins que el bo
 *    pendent es cobri, moment en què `resumeAfterCyclePayment` la desperta i el
 *    barrido següent la posa al dia. Sense això, un client que no paga aniria
 *    acumulant un bo pendent cada mes.
 *
 *    Això funciona TAMBÉ amb `pending_payment_cancel_enabled` apagat, que és com
 *    està a producció: allà l'escombrat de la 0044 no corre i el bo es queda
 *    pendent per sempre, però aquest fre no en depèn gens.
 *
 * 2. LA DATA MANA SOBRE EL DIA D'EXECUCIÓ. El cicle nou comença el dia que
 *    tocava, no el dia que el cron ha corregut. Si no, cada retard d'unes hores
 *    empenyeria l'aniversari del client cap endavant.
 *
 * 3. ES POSA AL DIA SALTANT ELS MESOS JA PASSATS. Si el cron ha estat aturat
 *    cinc setmanes, emetre el bo del mes que ja s'ha acabat no serviria de res:
 *    naixeria caducat. S'avança fins al cicle que conté avui i s'emet aquell. No
 *    es cobra retroactivament el que no s'ha donat.
 *
 * Idempotent: si torna a córrer el mateix dia, l'índex únic de la 0072 impedeix
 * el segon bo i la data de renovació ja no compleix la condició.
 */
export async function renewDueSubscriptions(
  today: string = centerToday(),
): Promise<RenewalOutcome[]> {
  const due = await listSubscriptionsDueForRenewal(today);
  const out: RenewalOutcome[] = [];

  for (const sub of due) {
    // Les de targeta les mou Stripe. Aquí es filtren i no a la consulta perquè
    // `listSubscriptionsDueForRenewal` respongui sempre la mateixa pregunta —"a
    // qui li toca?"— la faci qui la faci, també el panell de l'admin.
    if (sub.paymentMethod !== "cash") continue;

    try {
      const outcome = await renewOne(sub, today);
      out.push(outcome);
    } catch (e) {
      // Una subscripció que peta no pot endur-se les altres: cadascuna és el mes
      // d'una persona diferent. Torna a provar-ho el barrido de demà.
      console.error(`[subscripcions] ${sub.id} no s'ha pogut renovar:`, e);
      out.push({
        kind: "failed",
        subscriptionId: sub.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return out;
}

async function renewOne(sub: Subscription, today: string): Promise<RenewalOutcome> {
  const scheduled = sub.nextRenewalOn;
  // No hauria de passar —el constraint de la 0072 exigeix data a tot el que no
  // està cancel·lat— però si passés, renovar a cegues seria pitjor que aturar-se.
  if (!scheduled)
    return { kind: "failed", subscriptionId: sub.id, error: "sense data de renovació" };

  // Qui ha demanat baixa conserva el mes que ja tenia i aquí s'acaba.
  if (sub.cancelAtPeriodEnd) {
    await updateSubscription(sub.id, {
      status: "cancelled",
      nextRenewalOn: null,
      cancelledAt: new Date().toISOString(),
    });
    await notifySubscriptionCancelled(sub);
    return { kind: "cancelled", subscriptionId: sub.id, clientId: sub.clientId };
  }

  // El mes que s'acaba, ¿s'ha cobrat? Es mira el cobrament i no l'estat del bo:
  // el motiu, que no és evident, viu a `isCycleSettled`.
  const previous = await getCycleBono(sub.id, sub.currentCycleStart);
  if (!(await isCycleSettled(previous))) {
    await updateSubscription(sub.id, { status: "past_due" });
    await notifySubscriptionPaymentFailed(sub, sub.currentCycleStart);
    return { kind: "paused", subscriptionId: sub.id, clientId: sub.clientId };
  }

  // El cicle que conté avui: si el cron ha faltat mesos, se salten els que ja
  // han passat sencers en comptes d'emetre'ls caducats.
  let cycleStart = scheduled;
  let next = renewalAfter(cycleStart, sub.anchorDay);
  while (next <= today) {
    cycleStart = next;
    next = renewalAfter(cycleStart, sub.anchorDay);
  }

  const bono = await issueCycleBono({
    subscription: sub,
    cycleStart,
    status: "pending_payment",
  });

  // Les sèries que el client hagi marcat per allargar-se, ara que ja té
  // sessions. Va DESPRÉS del bo i abans de la data: si peta, la renovació encara
  // no consta feta i el barrido de demà hi tornarà (el bo no es duplicarà, que
  // d'això ja se n'encarrega l'índex únic de la 0072).
  const seriesExtended = await extendSeries(sub);

  // L'ordre importa: primer el bo, després la data. Si peta pel mig, la
  // subscripció segueix devent la renovació i demà s'hi torna; el bo ja emès no
  // es duplica perquè l'índex únic de la 0072 no ho permet.
  await updateSubscription(sub.id, {
    currentCycleStart: cycleStart,
    nextRenewalOn: next,
  });

  await notifySubscriptionRenewed(sub, cycleStart, cycleExpiry(cycleStart, sub.anchorDay));

  return {
    kind: "renewed",
    subscriptionId: sub.id,
    clientId: sub.clientId,
    bonoId: bono.id,
    cycleStart,
    seriesExtended,
  };
}

/**
 * Allarga les sèries del client, si en té cap marcada.
 *
 * No tomba la renovació si falla: el mes ja està emès i el client ja té les
 * seves sessions. Que una sèrie no s'hagi pogut allargar és un disgust, però
 * perdre la renovació sencera per una franja ocupada seria molt pitjor.
 *
 * El QUE HA PASSAT, en canvi, sí que puja. Abans es descartava, i el resultat
 * va ser que una extensió que no reservava res s'assemblava exactament a una
 * que no tenia res a reservar: el bug de la clau anon —cap sessió al cron, cap
 * regla de disponibilitat, cap reserva— hauria pogut viure mesos així.
 */
async function extendSeries(
  sub: Subscription,
): Promise<{ created: number; waitlisted: number; failed: number }> {
  const zero = { created: 0, waitlisted: 0, failed: 0 };
  try {
    const out = await extendSeriesForSubscription(sub);
    const total = out.reduce(
      (acc, o) => ({
        created: acc.created + o.created,
        waitlisted: acc.waitlisted + o.waitlisted,
        failed: acc.failed + o.failed,
      }),
      zero,
    );
    if (total.failed > 0)
      console.error(
        `[subscripcions] ${sub.id}: ${total.failed} ocurrències de sèrie no s'han pogut col·locar.`,
      );
    return total;
  } catch (e) {
    console.error(`[subscripcions] ${sub.id}: les sèries no s'han allargat:`, e);
    return { ...zero, failed: 1 };
  }
}
