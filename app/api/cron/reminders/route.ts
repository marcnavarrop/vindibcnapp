import { NextResponse, type NextRequest } from "next/server";
import {
  listTomorrowReminderTargets,
  listTomorrowTrainerAgendas,
  listExpiringBonoTargets,
  cancelOverduePendingBonos,
  tomorrowMadrid,
  BONO_EXPIRY_WARNING_DAYS,
} from "@/lib/data/reminders";
import { sweepExpiredBonos } from "@/lib/data/bonos";
import {
  renewDueSubscriptions,
  type RenewalOutcome,
} from "@/lib/data/subscription-renewal";
import { resumeDueSubscriptions } from "@/lib/data/subscription-pause";
import { notifyOnce } from "@/lib/notifications";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerHour, centerToday } from "@/lib/center-time";
import { toucaEnviarAvisos } from "@/lib/cron-window";
import { prunePasswordResetRequests } from "@/lib/data/password-reset";

export const dynamic = "force-dynamic";

/** El resum de la passada de renovacions, que es diu des de dues sortides. */
function summarize(renewals: RenewalOutcome[]) {
  return {
    due: renewals.length,
    renewed: renewals.filter((r) => r.kind === "renewed").length,
    paused_unpaid: renewals.filter((r) => r.kind === "paused").length,
    cancelled: renewals.filter((r) => r.kind === "cancelled").length,
    failed: renewals.filter((r) => r.kind === "failed").length,
    // L'extensió automàtica de sèries (0074). Es diu perquè, sense dir-ho, una
    // que no reserva res s'assembla massa a una que no tenia res a reservar.
    seriesExtended: renewals
      .filter((r) => r.kind === "renewed")
      .reduce(
        (acc, r) => ({
          created: acc.created + r.seriesExtended.created,
          waitlisted: acc.waitlisted + r.seriesExtended.waitlisted,
          failed: acc.failed + r.seriesExtended.failed,
        }),
        { created: 0, waitlisted: 0, failed: 0 },
      ),
  };
}


/**
 * Recordatoris de sessió del dia següent. Protegit amb CRON_SECRET: només
 * s'executa si la capçalera Authorization és `Bearer <CRON_SECRET>`. Idempotent:
 * notifyOnce evita reenviar un recordatori ja enviat (per si el cron corre dos
 * cops). El plan gratuït de Vercel només permet 1 cron/dia (aquest).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET no configurat" },
      { status: 500 },
    );
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  // ─── Subscripcions que toca renovar ───
  //
  // VA ABANS DE LA GUARDA DE L'HORA, i això no és un detall d'ordre sinó una
  // correcció. `reminder_hour_local` existeix per no enviar els RECORDATORIS
  // massa d'hora, i mentre la renovació quedava a sota en depenia sense cap
  // motiu: un centre que posés l'hora d'avisos a les 22 —quan el cron ja ha
  // corregut a les 20 locals— hauria deixat de renovar subscripcions per sempre,
  // en silenci. Cobrar un mes i emetre'n les sessions no és una preferència
  // d'enviament; passa el dia que toca, corri el cron a l'hora que corri.
  //
  // Només toca les que es paguen al centre; les de targeta les mou Stripe pel
  // seu compte. El cicle és mensual i el cron, diari: la resolució és la que
  // cal. Si un dia no corre, l'endemà recull les que van quedar enrere i se
  // salta els mesos ja passats en comptes d'emetre'ls caducats.
  // Les congelades a qui els toca despertar-se van PRIMER: si avui és el dia de
  // la represa I el de la renovació, el que ha de passar és que es reprengui i
  // després es renovi, no que es quedi un mes més aturada per ordre d'execució.
  const resumed = await resumeDueSubscriptions(centerToday());

  const renewals = await renewDueSubscriptions(centerToday());

  // ─── Estat dels bons: tampoc depèn de l'hora dels avisos ───
  //
  // PUGEN PER SOBRE DE LA GUARDA pel mateix motiu que les subscripcions. Que un
  // bo estigui caducat, o que un de pendent hagi passat el termini i alliberi
  // les seves franges, és estat del negoci: passa el dia que toca, corri el
  // cron a l'hora que corri. Deixar-ho a sota volia dir que amb l'hora mal
  // configurada no s'escombrés mai.
  //
  // `sweepExpiredBonos` és PERESÓS a posta i per això no fa mal quedar-se
  // enrere: `isBonoExpired` ja descarta els caducats a la lectura. L'altre sí
  // que en fa: cancel·la bons i allibera reserves.
  await sweepExpiredBonos();

  // ─── Bons pendents de pagament que han passat el termini ───
  // Anul·la el bo i allibera les franges futures que ocupava. Un bo que mai
  // s'ha fet servir per reservar no entra aquí: no li treu el lloc a ningú.
  //
  // L'AVÍS VIATJA AMB EL BARRIDO i no es queda a sota de la guarda. Separar-los
  // seria pitjor que no pujar cap dels dos: el bo es cancel·laria avui, l'avís
  // esperaria a una passada que ja no el trobaria a la llista —perquè ja està
  // cancel·lat— i el client no s'assabentaria MAI que li han tret unes sessions
  // que tenia reservades.
  const unpaid = await cancelOverduePendingBonos();
  let unpaidSent = 0;
  let unpaidSkipped = 0;
  for (const b of unpaid) {
    const did = await notifyOnce(
      {
        type: "bono_unpaid_cancelled",
        recipient: b.recipient,
        relatedId: b.relatedId,
        data: {
          name: b.recipient.name ?? "",
          serviceType: b.serviceType,
          cancelled: String(b.cancelledCount),
        },
      },
      // Obligatori: li acabem de cancel·lar sessions ja reservades. Si no ho
      // sap, es presenta a una sessió que ja no existeix.
      { ignorePreferences: true },
    );
    if (did) unpaidSent++;
    else unpaidSkipped++;
  }

  const bonosUnpaid = {
    cancelled: unpaid.length,
    sessionsFreed: unpaid.reduce((n, b) => n + b.cancelledCount, 0),
    processed: unpaidSent,
    skipped_already_sent: unpaidSkipped,
  };

  // ─── Neteja del fre del restabliment (0081) ───
  // Files que ja no frenen res. També per sobre de la guarda: és manteniment,
  // no un avís, i deixar-ho a sota faria créixer la taula per sempre.
  const resetPruned = await prunePasswordResetRequests();

  // ─── Hora d'enviament configurable ───
  //
  // A partir d'aquí ve el que SÍ que és una preferència d'enviament: avisos de
  // cortesia que el centre vol que surtin a una hora concreta.
  //
  // LIMITACIÓ: el pla gratuït de Vercel només permet UN cron diari, amb l'hora
  // fixada a vercel.json (no es pot canviar sense desplegar). Per això la guarda
  // no pot ser `horaLocal < reminderHourLocal` a seques: amb una sola passada,
  // "encara és aviat" i "avui no s'envia mai" són la mateixa condició. Es frena
  // NOMÉS si queda avui una passada que caigui ja a l'hora bona. Tot el
  // raonament i les dates concretes són a lib/cron-window.ts.
  const { reminderHourLocal } = await getCenterSettings();
  const ara = new Date();
  const horaLocal = centerHour(ara);
  if (!toucaEnviarAvisos(ara, reminderHourLocal)) {
    return NextResponse.json({
      ok: true,
      skipped: "encara no és l'hora configurada i avui queda una passada millor",
      horaLocalDelCentre: horaLocal,
      reminderHourLocal,
      // Tot això SÍ que s'ha fet: no depèn de l'hora dels avisos.
      subscriptions: { ...summarize(renewals), resumed },
      bonosUnpaid,
      resetPruned,
    });
  }

  const targets = await listTomorrowReminderTargets();
  let sent = 0;
  let skipped = 0;
  for (const t of targets) {
    const did = await notifyOnce({
      type: "session_reminder",
      recipient: t.recipient,
      relatedId: t.relatedId,
      data: {
        name: t.recipient.name ?? "",
        whenIso: t.scheduledAt,
        serviceType: t.serviceType,
        ...(t.trainerName ? { trainer: t.trainerName } : {}),
      },
    });
    if (did) sent++;
    else skipped++;
  }

  // Resum diari d'agenda per als professionals que el tinguin activat.
  const agendas = await listTomorrowTrainerAgendas();
  let agendaSent = 0;
  let agendaSkipped = 0;
  for (const a of agendas) {
    const did = await notifyOnce({
      type: "trainer_daily_agenda",
      recipient: a.recipient,
      relatedId: a.relatedId,
      data: {
        name: a.recipient.name ?? "",
        sessions: JSON.stringify(a.sessions),
      },
    });
    if (did) agendaSent++;
    else agendaSkipped++;
  }

  // ─── Bons a punt de caducar ───
  // S'enganxa al cron que ja existeix en comptes de muntar-ne un de nou: el
  // pla gratuït de Vercel només en permet un al dia. Els que ja han caducat
  // s'han tancat més amunt, abans de la guarda de l'hora.
  const expiring = await listExpiringBonoTargets(centerToday());
  let expSent = 0;
  let expSkipped = 0;
  for (const b of expiring) {
    const did = await notifyOnce({
      type: "bono_expiring_soon",
      recipient: b.recipient,
      relatedId: b.relatedId,
      data: {
        name: b.recipient.name ?? "",
        serviceType: b.serviceType,
        remaining: String(b.remainingSessions),
        expiresIso: b.expiresAt,
      },
    });
    if (did) expSent++;
    else expSkipped++;
  }

  return NextResponse.json({
    ok: true,
    day: tomorrowMadrid(),
    subscriptions: { ...summarize(renewals), resumed },
    bonosUnpaid,
    resetPruned,
    bonosExpiring: {
      window_days: BONO_EXPIRY_WARNING_DAYS,
      targets: expiring.length,
      processed: expSent,
      skipped_already_sent: expSkipped,
    },
    reminders: { targets: targets.length, processed: sent, skipped_already_sent: skipped },
    agendas: { trainers: agendas.length, processed: agendaSent, skipped_already_sent: agendaSkipped },
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
