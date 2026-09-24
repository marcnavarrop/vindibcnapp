"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  SERVICE_LABELS,
  RESERVATION_STATUS_LABELS,
  formatTime,
  formatDayHeading,
  dayKey,
} from "@/lib/labels";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import { SessionNotePanel } from "@/components/session-note-panel";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { SessionNote } from "@/lib/data/session-notes";
import type { ReservationStatus } from "@/types/database";
import { TAP } from "@/lib/utils";
import type { AgendaNav } from "@/lib/agenda-window";

const STATUS_TONE: Record<ReservationStatus, "info" | "success" | "danger"> = {
  booked: "info",
  completed: "success",
  cancelled: "danger",
};

type DayGroup = { day: string; items: ReservationListItem[] };

/** Cancel·lar i marcar feta: tornen si s'ha fet i, si no, per què. */
type StatefulReservationAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;

/** El que necessiten els botons d'una fila. */
type RowActions = {
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
};

function groupByDay(items: ReservationListItem[]): DayGroup[] {
  const map = new Map<string, ReservationListItem[]>();
  for (const r of items) {
    const key = dayKey(r.scheduledAt);
    (map.get(key) ?? map.set(key, []).get(key)!).push(r);
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }));
}

export function ReservationsAgenda({
  nav,
  notesFailed,
  reservations,
  trainers,
  nowISO,
  manageableIds,
  cancellableIds,
  notes,
  noteableIds,
  cancelAction,
  completeAction,
}: {
  /** Quants dies porta la llista cap a cada banda, i com demanar-ne més. */
  nav: AgendaNav;
  /**
   * Les notes no s'han pogut carregar. Es diu a la pantalla: una nota que no
   * surt perquè ha fallat la consulta s'ha de poder distingir d'una sessió
   * que no en té.
   */
  notesFailed?: boolean;
  reservations: ReservationListItem[];
  trainers: { id: string; name: string }[];
  nowISO: string;
  /**
   * Si se pasa, solo las reservas cuyos id estén aquí muestran botones de
   * gestión (Fet/Cancel·lar). Si se omite, todas son gestionables (admin).
   */
  manageableIds?: string[];
  /**
   * Les que es poden CANCEL·LAR si és una llista diferent (el professional: la
   * seva agenda, encara que el client sigui d'un company). Sense, les mateixes
   * que `manageableIds`.
   */
  cancellableIds?: string[];
  /**
   * Les accions de l'àrea on s'és. Abans s'importaven les de l'ADMIN aquí
   * dins, també a l'àrea del professional, i revalidaven /admin: la seva
   * llista no es refrescava després de cancel·lar.
   */
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
  /** Les notes que qui mira POT llegir, per id de reserva. La RLS ja ha filtrat. */
  notes?: Record<string, SessionNote>;
  /**
   * Les reserves de les quals qui mira pot ESCRIURE la nota: les que va donar
   * ELL. Llista diferent i més estreta que `manageableIds`, que són les dels
   * seus clients —amb aquelles pot marcar "Fet" encara que la sessió la donés
   * un company, però la nota no és seva.
   *
   * Ull amb el default: si no es passa, aquí NO escriu ningú, al revés que
   * `manageableIds`, on l'absència vol dir "tot" (admin). Els dos silencis
   * volen dir coses contràries a posta: obrir la gestió a l'admin és el que
   * toca; obrir-li l'escriptura de les notes, no.
   */
  noteableIds?: string[];
}) {
  const [trainer, setTrainer] = useState("");
  const [status, setStatus] = useState("");
  const manageable = useMemo(
    () => (manageableIds ? new Set(manageableIds) : null),
    [manageableIds],
  );
  const cancellable = useMemo(
    () => {
      const ids = cancellableIds ?? manageableIds;
      return ids ? new Set(ids) : null;
    },
    [cancellableIds, manageableIds],
  );
  const actions: RowActions = { cancelAction, completeAction };
  // Sense llista, ningú escriu. El contrari de `manageable`, que sense llista
  // ho obre tot: allà l'absència vol dir "admin"; aquí, "no és teva".
  const noteable = useMemo(() => new Set(noteableIds ?? []), [noteableIds]);

  const { upcoming, past } = useMemo(() => {
    const filtered = reservations.filter(
      (r) =>
        (!trainer || r.trainerId === trainer) &&
        (!status || r.status === status),
    );
    const upcoming = filtered
      .filter((r) => r.scheduledAt >= nowISO)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const past = filtered
      .filter((r) => r.scheduledAt < nowISO)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return { upcoming: groupByDay(upcoming), past: groupByDay(past) };
  }, [reservations, trainer, status, nowISO]);

  const selectClass =
    "rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20";

  return (
    <div className="flex flex-col gap-8">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={trainer}
          onChange={(e) => setTrainer(e.target.value)}
          className={selectClass}
          aria-label="Filtrar per professional"
        >
          <option value="">Tots els professionals</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
          aria-label="Filtrar per estat"
        >
          <option value="">Tots els estats</option>
          {(
            Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <Section
        title={`Properes · ${nav.ahead} dies`}
        groups={upcoming}
        emptyLabel={`No hi ha reserves en els pròxims ${nav.ahead} dies.`}
        moreHref={nav.href.moreAhead}
        canManage={(id) => !manageable || manageable.has(id)}
        canCancel={(id) => !cancellable || cancellable.has(id)}
        actions={actions}
      />
      {/* La nota només surt a "Passades": parla de com ha anat la sessió, i
          d'una que no ha començat encara no hi ha res a dir. El servidor ho
          torna a comprovar (`sessionHasStarted`), això és perquè no surti el
          formulari on no toca. */}
      {notesFailed && (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
        >
          No s&apos;han pogut carregar les notes de sessió. Les reserves són
          aquestes, però ara mateix no es pot veure quines tenen nota.
        </p>
      )}
      <Section
        title={`Passades · ${nav.back} dies`}
        groups={past}
        emptyLabel={`No hi ha reserves en els darrers ${nav.back} dies.`}
        moreHref={nav.href.moreBack}
        canManage={(id) => !manageable || manageable.has(id)}
        canCancel={(id) => !cancellable || cancellable.has(id)}
        actions={actions}
        notes={notes}
        canWriteNote={(id) => noteable.has(id)}
      />
    </div>
  );
}

function Section({
  title,
  groups,
  emptyLabel,
  moreHref,
  canManage,
  canCancel,
  actions,
  notes,
  canWriteNote,
}: {
  title: string;
  groups: DayGroup[];
  emptyLabel: string;
  /** Amplia la finestra 30 dies més (per URL). Null al sostre d'un any. */
  moreHref: string | null;
  canManage: (id: string) => boolean;
  canCancel: (id: string) => boolean;
  actions: RowActions;
  notes?: Record<string, SessionNote>;
  canWriteNote?: (id: string) => boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
        {title}
      </h2>
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.day}>
              <h3 className="mb-2 text-sm font-bold text-brand-dark first-letter:uppercase">
                {formatDayHeading(g.day)}
              </h3>
              <div className="overflow-hidden rounded-2xl border border-brand-border bg-white divide-y divide-brand-border">
                {g.items.map((r) => (
                  <div key={r.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="w-12 font-bold text-brand-purple">
                      {formatTime(r.scheduledAt)}
                    </span>
                    <span className="font-bold text-brand-dark">
                      {r.clientName}
                    </span>
                    <span className="text-brand-muted">
                      {SERVICE_LABELS[r.serviceType]}
                    </span>
                    {r.isComplimentary && <Badge tone="warn">Cortesia</Badge>}
                    {r.trainerName && (
                      <span className="text-brand-muted">· {r.trainerName}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <Badge tone={STATUS_TONE[r.status]}>
                        {RESERVATION_STATUS_LABELS[r.status]}
                      </Badge>
                      {r.status === "booked" &&
                        (canManage(r.id) || canCancel(r.id)) && (
                          <ReservationActions
                            id={r.id}
                            canComplete={canManage(r.id)}
                            {...actions}
                          />
                        )}
                    </div>
                  </div>
                  {(notes || canWriteNote) && r.status !== "cancelled" && (
                    <SessionNotePanel
                      reservationId={r.id}
                      note={notes?.[r.id] ?? null}
                      canEdit={canWriteNote?.(r.id) ?? false}
                    />
                  )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {moreHref && (
        <Link
          href={moreHref}
          scroll={false}
          className={`mt-3 inline-block text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
        >
          Veure&apos;n més (30 dies)
        </Link>
      )}
    </section>
  );
}

/**
 * Els botons d'una fila. Cada fila té el seu estat —un hook no es pot cridar
 * dins d'un `.map()`— i espera la resposta: si el servidor diu que no, el motiu
 * surt aquí mateix en comptes de perdre's.
 */
function ReservationActions({
  id,
  canComplete,
  cancelAction,
  completeAction,
}: { id: string; canComplete: boolean } & RowActions) {
  const [cancelState, cancel, cancelling] = useActionState(cancelAction, {});
  const [completeState, complete, completing] = useActionState(completeAction, {});
  const error = cancelState.error ?? completeState.error ?? null;
  const busy = cancelling || completing;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {canComplete && (
          <form action={complete}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={busy}
              className={`rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-success hover:bg-success/10 disabled:opacity-60 ${TAP}`}
            >
              {completing ? "…" : "Fet"}
            </button>
          </form>
        )}
        <form action={cancel}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={busy}
            className={`rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-error hover:bg-error/10 disabled:opacity-60 ${TAP}`}
          >
            {cancelling ? "Cancel·lant…" : "Cancel·lar"}
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
