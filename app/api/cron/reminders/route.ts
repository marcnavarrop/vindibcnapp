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
import { notifyOnce } from "@/lib/notifications";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerHour, centerToday } from "@/lib/center-time";

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
  const renewals = await renewDueSubscriptions(centerToday());

  // ─── Hora d'enviament configurable ───
  // LIMITACIÓ: el pla gratuït de Vercel només permet UN cron diari, amb l'hora
  // fixada a vercel.json (no es pot canviar sense desplegar). Així doncs,
  // `reminder_hour_local` NO mou l'execució del cron: només decideix si, en la
  // finestra en què el cron ja corre, toca enviar o no. Si l'hora local del
  // centre encara no ha arribat al valor configurat, aquesta execució no envia
  // res i els recordatoris sortiran en la del dia següent.
  const { reminderHourLocal } = await getCenterSettings();
  const horaLocal = centerHour(new Date());
  if (horaLocal < reminderHourLocal) {
    return NextResponse.json({
      ok: true,
      skipped: "encara no és l'hora configurada",
      horaLocalDelCentre: horaLocal,
      reminderHourLocal,
      // Les renovacions SÍ que s'han fet: no depenen de l'hora dels avisos.
      subscriptions: summarize(renewals),
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
  // pla gratuït de Vercel només en permet un al dia. Abans de mirar quins
  // caduquen aviat, es tanquen els que ja ho han fet.
  await sweepExpiredBonos();
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

  // ─── Bons pendents de pagament que han passat el termini ───
  // Anul·la el bo i allibera les franges futures que ocupava. Un bo que mai
  // s'ha fet servir per reservar no entra aquí: no li treu el lloc a ningú.
  const unpaid = await cancelOverduePendingBonos();
  let unpaidSent = 0;
  let unpaidSkipped = 0;
  for (const b of unpaid) {
    const did = await notifyOnce({
      type: "bono_unpaid_cancelled",
      recipient: b.recipient,
      relatedId: b.relatedId,
      data: {
        name: b.recipient.name ?? "",
        serviceType: b.serviceType,
        cancelled: String(b.cancelledCount),
      },
    });
    if (did) unpaidSent++;
    else unpaidSkipped++;
  }

  return NextResponse.json({
    ok: true,
    day: tomorrowMadrid(),
    subscriptions: summarize(renewals),
    bonosUnpaid: {
      cancelled: unpaid.length,
      sessionsFreed: unpaid.reduce((n, b) => n + b.cancelledCount, 0),
      processed: unpaidSent,
      skipped_already_sent: unpaidSkipped,
    },
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
