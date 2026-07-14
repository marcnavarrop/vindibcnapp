import { NextResponse, type NextRequest } from "next/server";
import { SERVICE_LABELS } from "@/lib/labels";
import { listTomorrowReminderTargets, tomorrowMadrid } from "@/lib/data/reminders";
import { notifyOnce } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
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
        when: fmtWhen(t.scheduledAt),
        service: SERVICE_LABELS[t.serviceType],
        ...(t.trainerName ? { trainer: t.trainerName } : {}),
      },
    });
    if (did) sent++;
    else skipped++;
  }

  return NextResponse.json({
    ok: true,
    day: tomorrowMadrid(),
    targets: targets.length,
    processed: sent,
    skipped_already_sent: skipped,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
