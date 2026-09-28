"use client";

import { useActionState, useEffect, useState } from "react";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import { CENTER_TZ } from "@/lib/config";
import { SERVICE_LABELS } from "@/lib/labels";
import { ReservationSheet } from "@/components/reservation-sheet";
import { SessionNotePanel } from "@/components/session-note-panel";
import { TrialModal } from "@/components/weekly-calendar";
import type { ColorPalette } from "@/lib/colors";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import type { InboxReservation, TrainerInbox } from "@/lib/data/trainer-inbox";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";

type StatefulAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;
type PlainAction = (formData: FormData) => void | Promise<void>;

/*
 * En l'hora del CENTRE i no la del navegador: així el servidor i el navegador
 * escriuen el mateix (cap salt en hidratar), i és l'hora que la professional
 * té al cap.
 */
const whenFmt = new Intl.DateTimeFormat("ca-ES", {
  timeZone: CENTER_TZ,
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
/** «dj. 1/10 · 17:00»: curt, perquè al mòbil hi càpiga l'hora sencera. */
/** On es recorda que «Cal fer» s'ha plegat. */
const FOLDED_KEY = "vindi.trainer.calfer.plegada";

const when = (iso: string) => {
  const p = Object.fromEntries(whenFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}/${p.month} · ${p.hour}:${p.minute}`;
};

/**
 * «CAL FER»: el que la professional té pendent, a sobre de l'agenda.
 *
 * Sense res pendent no es pinta: ni una línia, ni un «no tens res».
 *
 * AL MÒBIL, PLEGADA. Una sola fila de 44 px amb el total i el desglossament
 * («3 per marcar · 1 nota · 1 prova»); la rejilla comença just a sota, com
 * després del PR 3b. En tocar-la s'obre la llista. A l'ordinador, que té
 * alçada de sobres, surt oberta.
 *
 * CADA COSA AMB LA SEVA ACCIÓ AL COSTAT, SENSE SORTIR DE LA PANTALLA:
 *   · per marcar → «Marcar feta» (la mateixa acció que el botó de la fitxa);
 *   · nota → «Escriure nota» obre el mateix formulari de nota de la fitxa;
 *   · prova → «Acceptar» / «Rebutjar» (rebutjar demana confirmació).
 * I tocar el nom obre la fitxa sencera, la mateixa de la rejilla.
 */
export function CalFerTray({
  inbox,
  palette,
  clientBase,
  cancelAction,
  completeAction,
  rescheduleAction,
  acceptTrialAction,
  rejectTrialAction,
}: {
  inbox: TrainerInbox;
  palette: ColorPalette;
  clientBase: string;
  cancelAction: StatefulAction;
  completeAction: StatefulAction;
  rescheduleAction: StatefulAction;
  acceptTrialAction: PlainAction;
  rejectTrialAction: PlainAction;
}) {
  const total = inbox.toMark.length + inbox.toNote.length + inbox.trials.length;
  /*
   * Plegada fins que se sap l'amplada: al mòbil no ha de fer cap salt. A
   * l'ordinador s'obre, llevat que qui la fa servir l'hagi plegada: això es
   * recorda en aquest navegador. Tornar-la a obrir esborra la preferència i
   * es torna al comportament de sempre.
   */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let folded = false;
    try {
      folded = window.localStorage.getItem(FOLDED_KEY) === "1";
    } catch {
      // Sense memòria: el comportament de sempre.
    }
    if (!folded && window.matchMedia("(min-width: 768px)").matches) setOpen(true);
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      if (next) window.localStorage.removeItem(FOLDED_KEY);
      else window.localStorage.setItem(FOLDED_KEY, "1");
    } catch {
      // Sense memòria: funciona igual, però no es recordarà.
    }
  };
  const [selected, setSelected] = useState<InboxReservation | null>(null);
  const [trial, setTrial] = useState<TrialHoldItem | null>(null);

  if (total === 0 && !inbox.notesFailed) return null;

  const parts = [
    inbox.toMark.length > 0 && `${inbox.toMark.length} per marcar`,
    inbox.toNote.length > 0 &&
      `${inbox.toNote.length} ${inbox.toNote.length === 1 ? "nota" : "notes"}`,
    inbox.trials.length > 0 &&
      `${inbox.trials.length} ${inbox.trials.length === 1 ? "prova" : "proves"}`,
  ].filter(Boolean) as string[];

  return (
    <section
      data-inbox
      aria-label="Cal fer"
      className="mb-3 rounded-xl border border-brand-orange/40 bg-white md:mb-4"
    >
      <button
        type="button"
        data-inbox-toggle
        aria-expanded={open}
        aria-controls="cal-fer-list"
        onClick={toggle}
        className={clsx(
          "flex min-h-11 w-full items-center gap-2 px-3 text-left",
          TAP_SURFACE,
        )}
      >
        <span className="text-sm font-bold text-brand-dark">Cal fer</span>
        {total > 0 && (
          <span
            data-inbox-count
            className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-bold text-white"
          >
            {total}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-brand-muted">
          {parts.join(" · ")}
        </span>
        <span aria-hidden className={clsx("text-brand-muted transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open && (
        <div
          id="cal-fer-list"
          className="max-h-[60vh] overflow-y-auto border-t border-brand-border px-3 pb-2 md:grid md:max-h-none md:gap-4 md:overflow-visible md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
          style={{ "--cols": parts.length || 1 } as React.CSSProperties}
        >
          {inbox.notesFailed && (
            <p role="status" className="mt-2 text-xs text-error md:col-span-full">
              No s&apos;han pogut llegir totes les notes: les notes per escriure no surten fins que es puguin comprovar.
            </p>
          )}

          {inbox.toMark.length > 0 && (
            <Group title="Per marcar" hint="Ja han passat i segueixen reservades.">
              {inbox.toMark.map((r) => (
                <Row key={r.id} kind="mark" id={r.id} onOpen={() => setSelected(r)} title={r.clientName} sub={subOf(r)}>
                  <MarkDone id={r.id} action={completeAction} />
                </Row>
              ))}
            </Group>
          )}

          {inbox.toNote.length > 0 && (
            <Group title="Notes per escriure" hint="Sessions teves fetes, sense nota.">
              {inbox.toNote.map((r) => (
                <NoteRow key={r.id} r={r} onOpen={() => setSelected(r)} />
              ))}
            </Group>
          )}

          {inbox.trials.length > 0 && (
            <Group title="Proves per respondre" hint="Sol·licituds de /prova a la teva agenda.">
              {inbox.trials.map((t) => (
                <Row
                  key={t.id}
                  kind="trial"
                  id={t.id}
                  onOpen={() => setTrial(t)}
                  title={t.fullName}
                  sub={`${when(t.scheduledAt)} · ${SERVICE_LABELS[t.serviceType]}`}
                >
                  <TrialActions id={t.id} accept={acceptTrialAction} reject={rejectTrialAction} />
                </Row>
              ))}
            </Group>
          )}

          {inbox.truncated && (
            <p className="mt-2 text-xs text-brand-muted md:col-span-full">
              N&apos;hi ha més de les que surten aquí: mostrem les més recents.
            </p>
          )}
        </div>
      )}

      {selected && (
        <ReservationSheet
          r={selected}
          palette={palette}
          // Els mateixos permisos que a la rejilla: marcar i reprogramar, si el
          // client és seu; cancel·lar, també si la sessió és de la seva agenda;
          // la nota, només si la sessió l'ha donada ella.
          canManage={selected.clientMine}
          canCancel={selected.clientMine || selected.trainerId === inbox.trainerId}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          note={inbox.notes[selected.id] ?? null}
          canWriteNote={selected.trainerId === inbox.trainerId}
          clientHref={`${clientBase}/${selected.clientId}`}
          reschedulePicker
          onClose={() => setSelected(null)}
        />
      )}
      {trial && (
        <TrialModal
          t={trial}
          canManage
          acceptAction={acceptTrialAction}
          rejectAction={rejectTrialAction}
          onClose={() => setTrial(null)}
        />
      )}
    </section>
  );
}

const subOf = (r: InboxReservation) =>
  `${when(r.scheduledAt)} · ${SERVICE_LABELS[r.serviceType]}`;

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <h3 className="text-xs font-bold tracking-wide text-brand-muted uppercase">
        {title} <span className="font-normal tracking-normal normal-case">· {hint}</span>
      </h3>
      <ul className="mt-1 flex flex-col divide-y divide-brand-border md:max-h-64 md:overflow-y-auto">{children}</ul>
    </div>
  );
}

function Row({
  kind,
  id,
  title,
  sub,
  onOpen,
  children,
}: {
  kind: "mark" | "note" | "trial";
  id: string;
  title: string;
  sub: string;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li data-inbox-item={kind} data-id={id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
      <button
        type="button"
        onClick={onOpen}
        className={clsx("flex min-h-11 min-w-32 flex-1 flex-col justify-center text-left", TAP)}
      >
        <span className="truncate text-sm font-bold text-brand-dark">{title}</span>
        <span className="text-xs text-brand-muted first-letter:uppercase">{sub}</span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}

/** «Marcar feta», amb l'error aquí mateix si el servidor diu que no. */
function MarkDone({ id, action }: { id: string; action: StatefulAction }) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending || state.ok}
        className={`min-h-11 rounded-lg bg-brand-purple px-3 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-60 ${TAP_SURFACE}`}
      >
        {pending ? "Marcant…" : state.ok ? "Feta" : "Marcar feta"}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 max-w-48 text-right text-xs text-error">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Una nota per escriure: el formulari de sempre, obert aquí mateix. */
function NoteRow({ r, onOpen }: { r: InboxReservation; onOpen: () => void }) {
  const [writing, setWriting] = useState(false);
  return (
    <li data-inbox-item="note" data-id={r.id} className="py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={onOpen}
          className={clsx("flex min-h-11 min-w-32 flex-1 flex-col justify-center text-left", TAP)}
        >
          <span className="truncate text-sm font-bold text-brand-dark">{r.clientName}</span>
          <span className="text-xs text-brand-muted first-letter:uppercase">{subOf(r)}</span>
        </button>
        {!writing && (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className={`ml-auto min-h-11 shrink-0 rounded-lg border border-brand-purple px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/5 ${TAP_SURFACE}`}
          >
            Escriure nota
          </button>
        )}
      </div>
      {writing && (
        <SessionNotePanel reservationId={r.id} note={null} canEdit startOpen onCancel={() => setWriting(false)} />
      )}
    </li>
  );
}

/** Acceptar d'un toc; rebutjar demana confirmació (allibera la franja). */
function TrialActions({
  id,
  accept,
  reject,
}: {
  id: string;
  accept: PlainAction;
  reject: PlainAction;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming)
    return (
      <>
        <form action={reject}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className={`min-h-11 rounded-lg border border-error px-3 text-sm font-bold text-error hover:bg-error/10 ${TAP_SURFACE}`}
          >
            Sí, rebutja
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={`min-h-11 px-2 text-sm font-bold text-brand-muted ${TAP}`}
        >
          No
        </button>
      </>
    );
  return (
    <>
      <form action={accept}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className={`min-h-11 rounded-lg bg-brand-purple px-3 text-sm font-bold text-white hover:bg-brand-purple-light ${TAP_SURFACE}`}
        >
          Acceptar
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`min-h-11 rounded-lg border border-brand-border px-3 text-sm font-bold text-error hover:bg-error/10 ${TAP_SURFACE}`}
      >
        Rebutjar
      </button>
    </>
  );
}
