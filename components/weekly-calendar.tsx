"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/utils";
import {
  SERVICE_LABELS,
  SERVICE_COLORS,
  RESERVATION_STATUS_LABELS,
  GROUP_CAPACITY,
} from "@/lib/labels";
import {
  isHourAvailable,
  type AvailabilityRuleLite,
} from "@/lib/availability-slots";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";

// Franja horaria por defecto del centro (se amplía si hay reservas fuera).
const DEFAULT_OPEN = 7;
const DEFAULT_CLOSE = 22;

const DAY_NAMES = [
  "Dilluns",
  "Dimarts",
  "Dimecres",
  "Dijous",
  "Divendres",
  "Dissabte",
  "Diumenge",
];

type ReservationAction = (formData: FormData) => void | Promise<void>;

function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Lunes = 0
  d.setDate(d.getDate() - dow);
  return d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const pad = (n: number) => String(n).padStart(2, "0");
/** Formato para datetime-local (YYYY-MM-DDTHH:mm), en hora local. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function WeeklyCalendar({
  reservations,
  manageableIds,
  newReservationBase,
  cancelAction,
  completeAction,
  rescheduleAction,
  availability,
  trials = [],
  manageableTrialIds = [],
  acceptTrialAction,
  rejectTrialAction,
}: {
  reservations: ReservationListItem[];
  manageableIds: string[];
  /** Ruta del formulario de nueva reserva (se le añade ?at=ISO). */
  newReservationBase: string;
  cancelAction: ReservationAction;
  completeAction: ReservationAction;
  rescheduleAction: ReservationAction;
  /** Si se pasa, sombrea las franjas dentro de la disponibilidad declarada. */
  availability?: AvailabilityRuleLite[];
  /** Sessions de prova (pending/confirmed) per pintar diferenciades. */
  trials?: TrialHoldItem[];
  manageableTrialIds?: string[];
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
}) {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<ReservationListItem | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<TrialHoldItem | null>(null);

  const manageable = useMemo(() => new Set(manageableIds), [manageableIds]);
  const manageableTrials = useMemo(
    () => new Set(manageableTrialIds),
    [manageableTrialIds],
  );

  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date()), weekOffset * 7),
    [weekOffset],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Reservas de esta semana, agrupadas por (día, hora).
  const { cells, hours, groupOccupancy, trialCells } = useMemo(() => {
    const inWeek = reservations.filter((r) => {
      const d = new Date(r.scheduledAt);
      return d >= weekStart && d < weekEnd;
    });

    // Ocupación de grupo reducido por franja exacta (mismo scheduled_at).
    const occ = new Map<string, number>();
    for (const r of inWeek) {
      if (r.serviceType === "grupo_reducido" && r.status !== "cancelled") {
        occ.set(r.scheduledAt, (occ.get(r.scheduledAt) ?? 0) + 1);
      }
    }

    const map = new Map<string, ReservationListItem[]>();
    let minH = DEFAULT_OPEN;
    let maxH = DEFAULT_CLOSE;
    for (const r of inWeek) {
      const d = new Date(r.scheduledAt);
      const dayIdx = (d.getDay() + 6) % 7;
      const h = d.getHours();
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h + 1);
      const key = `${dayIdx}-${h}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    // Sessions de prova d'aquesta setmana, agrupades per (dia, hora).
    const trialMap = new Map<string, TrialHoldItem[]>();
    for (const t of trials) {
      const d = new Date(t.scheduledAt);
      if (d < weekStart || d >= weekEnd) continue;
      const key = `${(d.getDay() + 6) % 7}-${d.getHours()}`;
      (trialMap.get(key) ?? trialMap.set(key, []).get(key)!).push(t);
    }

    const hrs: number[] = [];
    for (let h = minH; h < maxH; h++) hrs.push(h);
    return { cells: map, hours: hrs, groupOccupancy: occ, trialCells: trialMap };
  }, [reservations, trials, weekStart, weekEnd]);

  const monthLabel = new Intl.DateTimeFormat("ca-ES", {
    month: "long",
    year: "numeric",
  }).format(weekStart);

  return (
    <div>
      {/* Navegación de semana */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavButton label="Setmana anterior" onClick={() => setWeekOffset((w) => w - 1)}>
            ‹
          </NavButton>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-charcoal hover:bg-brand-bg"
          >
            Avui
          </button>
          <NavButton label="Setmana següent" onClick={() => setWeekOffset((w) => w + 1)}>
            ›
          </NavButton>
        </div>
        <span className="text-sm font-bold text-brand-dark capitalize">
          {monthLabel}
        </span>
      </div>

      {/* Grid semanal (scroll horizontal en mòbil) */}
      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <div className="min-w-[56rem]">
          {/* Cabecera de días */}
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-brand-border">
            <div className="bg-brand-bg" />
            {days.map((d, i) => {
              const isToday =
                d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={clsx(
                    "border-l border-brand-border px-2 py-2 text-center",
                    isToday ? "bg-brand-purple/5" : "bg-brand-bg",
                  )}
                >
                  <div className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                    {DAY_NAMES[i].slice(0, 3)}
                  </div>
                  <div
                    className={clsx(
                      "text-sm font-bold",
                      isToday ? "text-brand-purple" : "text-brand-dark",
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filas por hora */}
          {hours.map((h) => (
            <div
              key={h}
              className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-brand-border last:border-0"
            >
              <div className="px-1 py-2 text-right text-xs font-bold text-brand-muted">
                {pad(h)}:00
              </div>
              {days.map((d, dayIdx) => {
                const items = cells.get(`${dayIdx}-${h}`) ?? [];
                const slot = new Date(d);
                slot.setHours(h, 0, 0, 0);
                const goNew = () =>
                  router.push(
                    `${newReservationBase}?at=${encodeURIComponent(
                      toLocalInput(slot),
                    )}`,
                  );
                const inAvailability =
                  availability && isHourAvailable(availability, slot, h);
                return (
                  <div
                    key={dayIdx}
                    role="button"
                    tabIndex={0}
                    onClick={goNew}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && e.key === "Enter")
                        goNew();
                    }}
                    className={clsx(
                      "min-h-[3.25rem] cursor-pointer border-l border-brand-border p-1 text-left align-top hover:bg-brand-bg/60",
                      inAvailability && "bg-brand-purple/5",
                    )}
                    aria-label={`Nova reserva ${DAY_NAMES[dayIdx]} ${pad(h)}:00`}
                  >
                    <div className="flex flex-col gap-1">
                      {items.map((r) => (
                        <ReservationCard
                          key={r.id}
                          r={r}
                          canManage={manageable.has(r.id)}
                          occupancy={
                            r.serviceType === "grupo_reducido"
                              ? groupOccupancy.get(r.scheduledAt)
                              : undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r);
                          }}
                        />
                      ))}
                      {(trialCells.get(`${dayIdx}-${h}`) ?? []).map((t) => (
                        <TrialCard
                          key={t.id}
                          t={t}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrial(t);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Fes clic en una franja buida per crear una reserva, o en una reserva per
        veure&apos;n el detall. En pantalla petita, desplaça&apos;t lateralment.
      </p>

      {selected && (
        <ReservationModal
          r={selected}
          canManage={manageable.has(selected.id)}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          onClose={() => setSelected(null)}
        />
      )}

      {selectedTrial && (
        <TrialModal
          t={selectedTrial}
          canManage={manageableTrials.has(selectedTrial.id)}
          acceptAction={acceptTrialAction}
          rejectAction={rejectTrialAction}
          onClose={() => setSelectedTrial(null)}
        />
      )}
    </div>
  );
}

const TRIAL_COLOR = "#ff6d17"; // taronja de marca per a les proves

function TrialCard({
  t,
  onClick,
}: {
  t: TrialHoldItem;
  onClick: (e: React.MouseEvent) => void;
}) {
  const pending = t.status === "pending";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: `${TRIAL_COLOR}1a`,
        border: `1.5px ${pending ? "dashed" : "solid"} ${TRIAL_COLOR}`,
      }}
      className="block w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-[11px] leading-tight"
      title={`Prova · ${t.fullName}`}
    >
      <span className="flex items-center gap-1">
        <span
          className="rounded px-1 text-[9px] font-bold text-white"
          style={{ backgroundColor: TRIAL_COLOR }}
        >
          PROVA
        </span>
        <span className="truncate font-bold text-brand-dark">{t.fullName}</span>
      </span>
      <span className="block" style={{ color: TRIAL_COLOR }}>
        {pending ? "Pendent" : "Confirmada"}
      </span>
    </button>
  );
}

function TrialModal({
  t,
  canManage,
  acceptAction,
  rejectAction,
  onClose,
}: {
  t: TrialHoldItem;
  canManage: boolean;
  acceptAction?: ReservationAction;
  rejectAction?: ReservationAction;
  onClose: () => void;
}) {
  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t.scheduledAt));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-3 h-1.5 w-12 rounded-full"
          style={{ backgroundColor: TRIAL_COLOR }}
        />
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: TRIAL_COLOR }}
          >
            SESSIÓ DE PROVA
          </span>
          <span className="text-xs font-bold text-brand-muted uppercase">
            {t.status === "pending" ? "Pendent" : "Confirmada"}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-bold text-brand-dark">{t.fullName}</h2>
        <p className="mt-1 text-sm text-brand-muted capitalize">{when}</p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Telèfon</dt>
            <dd className="font-bold text-brand-dark">
              <a href={`tel:${t.phone}`} className="hover:text-brand-purple">
                {t.phone}
              </a>
            </dd>
          </div>
        </dl>

        {canManage && (acceptAction || rejectAction) ? (
          <div className="mt-5 flex items-center gap-2">
            {t.status === "pending" && acceptAction && (
              <form action={acceptAction} className="flex-1" onSubmit={onClose}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light"
                >
                  Acceptar
                </button>
              </form>
            )}
            {rejectAction && (
              <form action={rejectAction} className="flex-1" onSubmit={onClose}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10"
                >
                  Rebutjar
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="mt-5 text-sm text-brand-muted">
            Només l&apos;entrenador/a d&apos;aquesta prova la pot gestionar.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
        >
          Tancar
        </button>
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold text-brand-charcoal hover:bg-brand-bg"
    >
      {children}
    </button>
  );
}

function ReservationCard({
  r,
  canManage,
  occupancy,
  onClick,
}: {
  r: ReservationListItem;
  canManage: boolean;
  occupancy?: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const color = SERVICE_COLORS[r.serviceType];
  const cancelled = r.status === "cancelled";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: `${color}1a`,
        borderLeft: `3px solid ${color}`,
      }}
      className={clsx(
        "block w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-[11px] leading-tight",
        cancelled && "opacity-50 line-through",
      )}
      title={`${r.clientName} · ${SERVICE_LABELS[r.serviceType]}`}
    >
      <span className="flex items-center gap-1 font-bold text-brand-dark">
        <span className="truncate">{r.clientName}</span>
        {!canManage && <LockIcon />}
      </span>
      <span className="block truncate" style={{ color }}>
        {SERVICE_LABELS[r.serviceType]}
        {occupancy != null && ` · ${occupancy}/${GROUP_CAPACITY}`}
      </span>
    </button>
  );
}

function ReservationModal({
  r,
  canManage,
  cancelAction,
  completeAction,
  rescheduleAction,
  onClose,
}: {
  r: ReservationListItem;
  canManage: boolean;
  cancelAction: ReservationAction;
  completeAction: ReservationAction;
  rescheduleAction: ReservationAction;
  onClose: () => void;
}) {
  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(r.scheduledAt));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-3 h-1.5 w-12 rounded-full"
          style={{ backgroundColor: SERVICE_COLORS[r.serviceType] }}
        />
        <h2 className="text-lg font-bold text-brand-dark">{r.clientName}</h2>
        <p className="mt-1 text-sm text-brand-muted capitalize">{when}</p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Field label="Servei" value={SERVICE_LABELS[r.serviceType]} />
          <Field label="Estat" value={RESERVATION_STATUS_LABELS[r.status]} />
          {r.trainerName && <Field label="Entrenador/a" value={r.trainerName} />}
        </dl>

        {canManage ? (
          r.status === "booked" ? (
            <>
            <form
              action={rescheduleAction}
              className="mt-5 flex flex-col gap-2 rounded-lg bg-brand-bg p-3"
            >
              <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Reprogramar
              </label>
              <input type="hidden" name="id" value={r.id} />
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  defaultValue={toLocalInput(new Date(r.scheduledAt))}
                  className="flex-1 rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-bold text-white hover:opacity-90"
                >
                  Desar
                </button>
              </div>
            </form>
            <div className="mt-2 flex items-center gap-2">
              <form action={completeAction} className="flex-1">
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light"
                >
                  Marcar feta
                </button>
              </form>
              <form action={cancelAction} className="flex-1">
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10"
                >
                  Cancel·lar
                </button>
              </form>
            </div>
            </>
          ) : (
            <p className="mt-5 text-sm text-brand-muted">
              Aquesta reserva ja està {RESERVATION_STATUS_LABELS[r.status].toLowerCase()}.
            </p>
          )
        ) : (
          <p className="mt-5 flex items-center gap-2 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            <LockIcon /> No és el teu client: només lectura.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
        >
          Tancar
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-brand-muted">{label}</dt>
      <dd className="font-bold text-brand-dark">{value}</dd>
    </div>
  );
}

function LockIcon() {
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
