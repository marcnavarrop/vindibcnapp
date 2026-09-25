"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import {
  RESERVATION_STATUS_LABELS,
  SERVICE_LABELS,
  formatDate,
} from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { CancelReservationConfirm } from "@/components/cancel-reservation-confirm";
import { SessionNotePanel } from "@/components/session-note-panel";
import { colorOfService, type ColorPalette } from "@/lib/colors";
import {
  getReservationDetailAction,
  type ReservationDetailResult,
} from "@/lib/actions/reservation-detail";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import type { SessionNote } from "@/lib/data/session-notes";

type ReservationAction = (formData: FormData) => void | Promise<void>;
type StatefulReservationAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;

const pad = (n: number) => String(n).padStart(2, "0");
/** Formato para datetime-local (YYYY-MM-DDTHH:mm), en hora local. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const whenFmt = new Intl.DateTimeFormat("ca-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * LA FITXA D'UNA RESERVA, per a l'admin i el professional.
 *
 * Hoja inferior al mòbil i plafó lateral a l'escriptori: el calendari es
 * continua veient al costat, i al mòbil el polze arriba als botons.
 *
 * El que ja té el calendari surt a l'instant. El que no —telèfon, bo, sèrie i
 * propera sessió— es demana en obrir (`getReservationDetailAction`) amb la
 * sessió de qui mira: els permisos són els de la RLS, els mateixos que a la
 * fitxa del client.
 *
 * QUI POT FER QUÈ no canvia i no es decideix aquí: arriba de la pàgina.
 *   · `canManage`: reprogramar, marcar feta i cancel·lar (els seus clients).
 *   · `canCancel`: només cancel·lar (la seva agenda, client d'un company; 0091).
 *   · `canWriteNote`: escriure la nota (qui va DONAR la sessió; 0079). L'admin
 *     no la rep mai: la llegeix, no l'escriu.
 */
export function ReservationSheet({
  r,
  palette,
  canManage,
  canCancel,
  cancelAction,
  completeAction,
  rescheduleAction,
  note,
  canWriteNote,
  clientHref,
  onClose,
}: {
  r: ReservationListItem;
  palette: ColorPalette;
  canManage: boolean;
  canCancel: boolean;
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
  rescheduleAction: ReservationAction;
  /** La nota, si la pàgina l'ha carregada (només sessions passades). */
  note: SessionNote | null;
  canWriteNote: boolean;
  /** On és la fitxa del client en aquesta àrea. */
  clientHref: string;
  onClose: () => void;
}) {
  const router = useRouter();
  /*
   * L'ÈXIT ES DIU QUAN EL SERVIDOR HO DIU, no en enviar el formulari: `done`
   * surt de la resposta, i l'error es pinta aquí mateix.
   */
  const [cancelState, cancel, cancelling] = useActionState(cancelAction, {});
  const [completeState, complete, completing] = useActionState(completeAction, {});
  const done = cancelState.ok ? "cancelled" : completeState.ok ? "completed" : null;
  const error = cancelState.error ?? completeState.error ?? null;
  const busy = cancelling || completing;

  const [detail, setDetail] = useState<ReservationDetailResult | null>(null);
  useEffect(() => {
    let live = true;
    setDetail(null);
    getReservationDetailAction(r.id)
      .then((d) => live && setDetail(d))
      .catch(() =>
        live &&
        setDetail({ ok: false, error: "No s'han pogut carregar les dades de la reserva." }),
      );
    return () => {
      live = false;
    };
  }, [r.id]);

  // Després de cancel·lar o marcar feta, el calendari s'ha de refrescar.
  const close = useCallback(() => {
    if (done) router.refresh();
    onClose();
  }, [done, router, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const start = new Date(r.scheduledAt);
  const isPast = start.getTime() <= Date.now();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-stretch md:justify-end"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reserva de ${r.clientName}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white shadow-xl md:h-full md:max-h-none md:w-[26rem] md:rounded-none"
      >
        {/* L'agafador només diu "això és una fulla" al mòbil. */}
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-brand-border md:hidden" />

        {done ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AnimatedFeedback type={done === "cancelled" ? "cancel" : "success"} />
            <h2 className="text-xl font-bold text-brand-dark">
              {done === "cancelled" ? "Reserva cancel·lada" : "Reserva marcada com feta"}
            </h2>
            <button
              type="button"
              onClick={close}
              className={`mt-2 w-full rounded-lg border border-brand-border px-4 py-2.5 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
            >
              Tancar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5 md:p-6">
            <header>
              <div
                className="mb-3 h-1.5 w-12 rounded-full"
                style={{ backgroundColor: colorOfService(palette, r.serviceType) }}
              />
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-brand-dark">{r.clientName}</h2>
                {r.isComplimentary && <Badge tone="warn">Cortesia</Badge>}
              </div>
              <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">
                {whenFmt.format(start)}
              </p>
            </header>

            <dl className="flex flex-col gap-2 text-sm">
              <Field label="Servei" value={SERVICE_LABELS[r.serviceType]} />
              <Field label="Estat" value={RESERVATION_STATUS_LABELS[r.status]} />
              {r.trainerName && <Field label="Professional" value={r.trainerName} />}
            </dl>

            <DetailBlock detail={detail} isComplimentary={r.isComplimentary} />

            <Link
              href={clientHref}
              className={`self-start text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
            >
              Fitxa del client →
            </Link>

            {/* Afegir al calendari només té sentit per a una sessió que
                encara ha de passar. */}
            {canManage && !isPast && r.status === "booked" && (
              <AddToCalendarButton
                serviceType={r.serviceType}
                otherPartyName={r.clientName}
                scheduledAt={r.scheduledAt}
              />
            )}

            {/* La nota: sessions que ja han començat i no cancel·lades. La
                pot escriure només qui la va donar; la resta la llegeix. */}
            {isPast && r.status !== "cancelled" && (
              <SessionNotePanel
                reservationId={r.id}
                note={note}
                canEdit={canWriteNote}
                closeOnSave
              />
            )}

            {canManage ? (
              r.status === "booked" ? (
                <div className="flex flex-col gap-2">
                  <form
                    action={rescheduleAction}
                    className="flex flex-col gap-2 rounded-lg bg-brand-bg p-3"
                  >
                    <label
                      htmlFor={`resched-${r.id}`}
                      className="text-xs font-bold tracking-wide text-brand-muted uppercase"
                    >
                      Reprogramar
                    </label>
                    <input type="hidden" name="id" value={r.id} />
                    {/* `min-w-0`: el datetime-local té una amplada pròpia que,
                        sense, empenyia «Desar» fora de la caixa a 375 px. */}
                    <div className="flex items-center gap-2">
                      <input
                        id={`resched-${r.id}`}
                        type="datetime-local"
                        name="scheduledAt"
                        required
                        defaultValue={toLocalInput(start)}
                        className="min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
                      />
                      <button
                        type="submit"
                        className={`shrink-0 rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-bold text-white hover:opacity-90 ${TAP}`}
                      >
                        Desar
                      </button>
                    </div>
                  </form>
                  <form action={complete}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      disabled={busy}
                      className={`w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-60 ${TAP_SURFACE}`}
                    >
                      {completing ? "Marcant…" : "Marcar feta"}
                    </button>
                  </form>
                  <CancelReservationConfirm
                    id={r.id}
                    action={cancel}
                    pending={cancelling}
                    disabled={busy}
                  />
                  {error && <ActionError message={error} />}
                </div>
              ) : (
                <p className="text-sm text-brand-muted">
                  Aquesta reserva ja està{" "}
                  {RESERVATION_STATUS_LABELS[r.status].toLowerCase()}.
                </p>
              )
            ) : canCancel && r.status === "booked" ? (
              <div className="flex flex-col gap-2">
                {/* La seva agenda, però no el seu client (0091): la pot
                    cancel·lar, no marcar feta ni reprogramar. */}
                <p className="flex items-center gap-2 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
                  <LockIcon /> No és el teu client, però és de la teva agenda: la
                  pots cancel·lar.
                </p>
                <CancelReservationConfirm
                  id={r.id}
                  action={cancel}
                  pending={cancelling}
                  disabled={busy}
                />
                {error && <ActionError message={error} />}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
                <LockIcon /> No és el teu client: només lectura.
              </p>
            )}

            <button
              type="button"
              onClick={close}
              className={`w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
            >
              Tancar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Telèfon, bo, sèrie i propera sessió: el que es demana en obrir. */
function DetailBlock({
  detail,
  isComplimentary,
}: {
  detail: ReservationDetailResult | null;
  isComplimentary: boolean;
}) {
  if (!detail)
    return (
      <p className="text-sm text-brand-muted" aria-live="polite">
        Carregant les dades del client…
      </p>
    );
  if (!detail.ok)
    return (
      <p role="alert" className="text-sm text-error">
        {detail.error}
      </p>
    );
  const d = detail.detail;
  return (
    <dl className="flex flex-col gap-2 border-t border-brand-border pt-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-brand-muted">Telèfon</dt>
        <dd className="flex min-w-0 items-center gap-2">
          {d.phone ? (
            <>
              <a
                href={`tel:${d.phone.replace(/\s+/g, "")}`}
                className="truncate font-bold text-brand-dark hover:text-brand-purple"
              >
                {d.phone}
              </a>
              <CopyButton text={d.phone} />
            </>
          ) : (
            <span className="text-brand-muted">No en tenim</span>
          )}
        </dd>
      </div>
      <Field
        label="Bo"
        value={
          d.bono
            ? `${SERVICE_LABELS[d.bono.serviceType]} · ${d.bono.remainingSessions} de ${d.bono.totalSessions} restants${
                d.bono.expiresAt ? ` · caduca ${formatDate(d.bono.expiresAt)}` : ""
              }`
            : isComplimentary
              ? "Cortesia: no en descompta cap"
              : "Sense bo"
        }
      />
      {d.series && (
        <Field
          label="Sèrie"
          value={`Sessió ${d.series.position} de ${d.series.total}`}
        />
      )}
      <Field
        label="Propera sessió"
        value={
          d.next
            ? `${whenFmt.format(new Date(d.next.scheduledAt))}${
                d.next.trainerName ? ` · ${d.next.trainerName}` : ""
              }`
            : "Cap de reservada"
        }
      />
    </dl>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Sense permís de porta-retalls: el número segueix sent seleccionable.
        }
      }}
      className={clsx(
        "shrink-0 rounded-md border border-brand-border px-2 py-0.5 text-xs font-bold",
        copied ? "text-success" : "text-brand-purple hover:bg-brand-bg",
        TAP,
      )}
    >
      {copied ? "Copiat" : "Copiar"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-brand-muted">{label}</dt>
      <dd className="text-right font-bold text-brand-dark first-letter:uppercase">
        {value}
      </dd>
    </div>
  );
}

function ActionError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-error">
      {message}
    </p>
  );
}

export function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="inline-block shrink-0 text-brand-muted"
      aria-label="Bloquejada"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
