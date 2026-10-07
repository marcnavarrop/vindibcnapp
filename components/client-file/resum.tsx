import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NextSessionReminderButton } from "@/components/client-notify-buttons";
import { SessionRow } from "@/components/client-file/sessions";
import { splitSessions } from "@/components/client-file/split-sessions";
import { PANEL_ACTION } from "@/components/client-file/panel";
import { SERVICE_LABELS, BONO_STATUS_LABELS, formatDate, formatEur, sessionDayParts } from "@/lib/labels";
import { clsx, TAP } from "@/lib/utils";
import type { ClientBono, ClientReservation } from "@/lib/data/clients";
import type { AssignedExercise } from "@/lib/data/client-exercises";
import type { ExerciseProgressEntry } from "@/lib/data/exercise-progress";

/**
 * EL RESUM DE LA FITXA: el que l'equip fa cada dia amb un client, a la vista
 * en obrir-la. Mirar els bons i cobrar, veure les properes sessions, llegir les
 * notes i saber com va l'entrenament. Abans hi havia el selector de
 * professional (ara a la capçalera) i dues xifres: «Sessions restants» sumava
 * EP i fisio, que no serveix per a res.
 */

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3 sm:px-5">
        <h2 className="text-xs font-bold tracking-wide text-brand-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Pendents i decaiguts primer: són els que demanen alguna cosa. */
const LIVE_ORDER: Partial<Record<ClientBono["status"], number>> = {
  pending_payment: 0,
  unpaid: 1,
  active: 2,
};

export function BonosSummaryCard({
  bonos,
  today,
  addHref,
  actions,
}: {
  bonos: ClientBono[];
  /** El dia del centre, per saber si un bo actiu ja ha passat de data. */
  today: string;
  addHref?: string;
  /** Els botons de cada bo (cobrar, anul·lar), si qui mira en pot fer. */
  actions?: (b: ClientBono) => React.ReactNode;
}) {
  const live = bonos
    .filter((b) => LIVE_ORDER[b.status] !== undefined)
    .sort((a, b) => LIVE_ORDER[a.status]! - LIVE_ORDER[b.status]!);
  const done = bonos.length - live.length;

  return (
    <Card
      title="Bons"
      action={
        addHref && (
          <Link href={addHref} className={`${PANEL_ACTION} ${TAP}`}>
            + Afegir bo
          </Link>
        )
      }
    >
      {live.length === 0 ? (
        <p className="px-4 py-3 text-sm text-brand-muted sm:px-5">No té cap bo actiu.</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {live.map((b) => {
            const waiting = b.status === "pending_payment" || b.status === "unpaid";
            const expired = b.status === "active" && !!b.expiresAt && b.expiresAt < today;
            const pct = b.totalSessions > 0 ? Math.round((b.remainingSessions / b.totalSessions) * 100) : 0;
            const extra = actions?.(b);
            return (
              <li key={b.id} className={clsx("flex flex-col gap-1.5 px-4 py-3 sm:px-5", waiting && "bg-attention-bg")}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold text-brand-dark">
                    {SERVICE_LABELS[b.serviceType]}
                    {waiting && <span className="font-normal text-brand-charcoal"> · {b.totalSessions} sessions</span>}
                  </span>
                  {expired ? (
                    <Badge tone="danger">Caducat</Badge>
                  ) : (
                    <Badge
                      tone={b.status === "active" ? "success" : b.status === "unpaid" ? "danger" : "attention"}
                      icon={b.status === "pending_payment" ? "pending" : undefined}
                    >
                      {b.status === "pending_payment" ? "Pendent" : BONO_STATUS_LABELS[b.status]}
                    </Badge>
                  )}
                </div>
                {waiting ? (
                  <p className="text-sm text-brand-charcoal tabular-nums">{formatEur(b.price)} per cobrar</p>
                ) : (
                  <>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-brand-border"
                      role="img"
                      aria-label={`Queden ${b.remainingSessions} de ${b.totalSessions} sessions`}
                    >
                      <div className="h-full rounded-full bg-brand-purple" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-sm text-brand-muted">
                      Queden{" "}
                      <b className="font-bold text-brand-charcoal tabular-nums">
                        {b.remainingSessions} de {b.totalSessions}
                      </b>
                      {" · "}
                      {b.expiresAt
                        ? `${expired ? "va caducar" : "caduca"} el ${formatDate(b.expiresAt)}`
                        : "sense caducitat"}
                    </p>
                  </>
                )}
                {extra && <div className="flex flex-wrap justify-end gap-2">{extra}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {done > 0 && (
        <p className="border-t border-brand-border px-4 py-2.5 text-sm text-brand-muted sm:px-5">
          {done === 1 ? "1 bo acabat" : `${done} bons acabats`} a «Bons i pagaments».
        </p>
      )}
    </Card>
  );
}

const UPCOMING_IN_SUMMARY = 3;

export function UpcomingSessionsCard({
  reservations,
  now,
  clientId,
  newHref,
}: {
  reservations: ClientReservation[];
  now: string;
  clientId: string;
  /** «+ Nova reserva», amb el client ja posat. Sense: no en pot crear. */
  newHref?: string;
}) {
  const { upcoming, past } = splitSessions(reservations, now);
  const lastDone = past.find((r) => r.status === "completed");
  const rest = upcoming.length - UPCOMING_IN_SUMMARY;

  return (
    <Card
      title="Properes sessions"
      action={
        newHref && (
          <Link href={newHref} className={`${PANEL_ACTION} ${TAP}`}>
            + Nova reserva
          </Link>
        )
      }
    >
      {upcoming.length === 0 ? (
        <p className="px-4 py-3 text-sm text-brand-muted sm:px-5">No té cap sessió reservada.</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {upcoming.slice(0, UPCOMING_IN_SUMMARY).map((r) => (
            <SessionRow key={r.id} r={r} now={now} />
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3 border-t border-brand-border px-4 py-3 sm:px-5">
        <p className="text-sm text-brand-muted">
          {rest > 0 && <>{rest === 1 ? "1 més" : `${rest} més`} a «Sessions». </>}
          {lastDone ? (
            <>
              Última feta:{" "}
              <span className="text-brand-charcoal">
                {(() => {
                  const d = sessionDayParts(lastDone.scheduledAt);
                  return `${d.weekday} ${d.day} ${d.month}`;
                })()}{" "}
                · {SERVICE_LABELS[lastDone.serviceType]}
              </span>
            </>
          ) : (
            "Encara no n'ha fet cap."
          )}
        </p>
        {upcoming.length > 0 && <NextSessionReminderButton clientId={clientId} />}
      </div>
    </Card>
  );
}

export function NotesCard({
  clinicalNotes,
  generalNotes,
  editHref,
  children,
}: {
  clinicalNotes: string | null;
  generalNotes: string | null;
  editHref?: string;
  /** La nota ràpida, si qui mira en pot escriure. */
  children?: React.ReactNode;
}) {
  return (
    <Card
      title="Notes"
      action={
        editHref && (
          <Link href={editHref} className={`${PANEL_ACTION} ${TAP}`}>
            Editar
          </Link>
        )
      }
    >
      <div className="flex flex-col gap-2.5 p-4 sm:px-5">
        <div className="rounded-xl border border-brand-clinical/30 bg-brand-clinical/5 px-3.5 py-2.5 text-sm">
          <h3 className="mb-1 text-[11.5px] font-bold tracking-wide text-brand-clinical uppercase">Clíniques</h3>
          <p className={clsx("whitespace-pre-wrap", clinicalNotes?.trim() ? "text-brand-charcoal" : "text-brand-muted")}>
            {clinicalNotes?.trim() || "Sense notes clíniques."}
          </p>
        </div>
        <div className="rounded-xl border border-brand-border px-3.5 py-2.5 text-sm">
          <h3 className="mb-1 text-[11.5px] font-bold tracking-wide text-brand-muted uppercase">Generals</h3>
          <p className={clsx("whitespace-pre-wrap", generalNotes?.trim() ? "text-brand-charcoal" : "text-brand-muted")}>
            {generalNotes?.trim() || "Sense notes generals."}
          </p>
        </div>
        {children}
      </div>
    </Card>
  );
}

export function TrainingCard({
  assigned,
  progress,
}: {
  assigned: AssignedExercise[];
  progress: ExerciseProgressEntry[];
}) {
  // L'última mesura de cada exercici, per veure d'una ullada si s'hi treballa.
  const last = new Map<string, ExerciseProgressEntry>();
  for (const p of progress) {
    const prev = last.get(p.clientExerciseId);
    if (!prev || p.recordedAt > prev.recordedAt) last.set(p.clientExerciseId, p);
  }
  return (
    <Card title="Entrenament">
      {assigned.length === 0 ? (
        <p className="px-4 py-3 text-sm text-brand-muted sm:px-5">No té cap exercici assignat.</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {assigned.map((a) => {
            const p = last.get(a.id);
            return (
              <li key={a.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0">
                  <b className="font-bold text-brand-dark">{a.name}</b>
                  {a.notes && <span className="text-brand-muted"> · {a.notes}</span>}
                </span>
                <span className="shrink-0 text-right text-brand-muted tabular-nums">
                  {p ? `${p.weightKg} kg · ${formatDate(p.recordedAt)}` : "sense registres"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
