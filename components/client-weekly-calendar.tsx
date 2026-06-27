"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/utils";
import { SERVICE_LABELS, SERVICE_COLORS, GROUP_CAPACITY } from "@/lib/labels";
import {
  isHourAvailable,
  type AvailabilityRuleLite,
} from "@/lib/availability-slots";
import type {
  ClientCalendarReservation,
  ClientReservationData,
} from "@/lib/data/reservations";
import type { FormState } from "@/app/(client)/client/reservas/actions";

const OPEN = 7;
const CLOSE = 22;
const DAY_NAMES = [
  "Dilluns",
  "Dimarts",
  "Dimecres",
  "Dijous",
  "Divendres",
  "Dissabte",
  "Diumenge",
];

type CreateAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;
type CancelAction = (formData: FormData) => void | Promise<void>;

function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;

export function ClientWeeklyCalendar({
  reservations,
  bonos,
  trainerName,
  availability,
  createAction,
  cancelAction,
}: {
  reservations: ClientCalendarReservation[];
  bonos: ClientReservationData["bonos"];
  trainerName: string | null;
  /** Reglas de disponibilidad del entrenador. Si está vacío, no se restringe. */
  availability: AvailabilityRuleLite[];
  createAction: CreateAction;
  cancelAction: CancelAction;
}) {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [bonoId, setBonoId] = useState(bonos[0]?.id ?? "");
  const [slot, setSlot] = useState<Date | null>(null);
  const [own, setOwn] = useState<ClientCalendarReservation | null>(null);

  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date()), weekOffset * 7),
    [weekOffset],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const { cells, hours } = useMemo(() => {
    const inWeek = reservations.filter((r) => {
      const d = new Date(r.scheduledAt);
      return d >= weekStart && d < weekEnd;
    });
    const map = new Map<string, ClientCalendarReservation[]>();
    let minH = OPEN;
    let maxH = CLOSE;
    for (const r of inWeek) {
      const d = new Date(r.scheduledAt);
      const h = d.getHours();
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h + 1);
      const key = `${(d.getDay() + 6) % 7}-${h}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    const hrs: number[] = [];
    for (let h = minH; h < maxH; h++) hrs.push(h);
    return { cells: map, hours: hrs };
  }, [reservations, weekStart, weekEnd]);

  const monthLabel = new Intl.DateTimeFormat("ca-ES", {
    month: "long",
    year: "numeric",
  }).format(weekStart);

  const selectedBono = bonos.find((b) => b.id === bonoId);

  return (
    <div>
      {/* Selector de bo */}
      {bonos.length === 0 ? (
        <p className="mb-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
          No tens cap bo actiu amb sessions disponibles. Parla amb el centre per
          adquirir-ne un.
        </p>
      ) : (
        <label className="mb-4 flex flex-col gap-1.5 text-sm">
          <span className="font-bold tracking-wide text-brand-charcoal uppercase">
            Bo amb què vols reservar
          </span>
          <select
            value={bonoId}
            onChange={(e) => setBonoId(e.target.value)}
            className="max-w-md rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
          >
            {bonos.map((b) => (
              <option key={b.id} value={b.id}>
                {SERVICE_LABELS[b.serviceType]} · {b.remaining} sessions
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Navegación de semana */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavBtn label="Setmana anterior" onClick={() => setWeekOffset((w) => w - 1)}>
            ‹
          </NavBtn>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-charcoal hover:bg-brand-bg"
          >
            Avui
          </button>
          <NavBtn label="Setmana següent" onClick={() => setWeekOffset((w) => w + 1)}>
            ›
          </NavBtn>
        </div>
        <span className="text-sm font-bold text-brand-dark capitalize">
          {monthLabel}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <div className="min-w-[56rem]">
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-brand-border">
            <div className="bg-brand-bg" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
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
                const cellDate = new Date(d);
                cellDate.setHours(h, 0, 0, 0);
                const inHours =
                  h >= OPEN && h < CLOSE && cellDate.getTime() > Date.now();

                const ownItems = items.filter((r) => r.isOwn);
                const groupItems = items.filter(
                  (r) => r.serviceType === "grupo_reducido",
                );
                const hasExclusive = items.some(
                  (r) => r.serviceType !== "grupo_reducido",
                );
                const groupCount = groupItems.length;
                const groupColor = SERVICE_COLORS.grupo_reducido;

                // Unirse a un grupo existente con plazas (con un bono de grupo).
                const groupJoinable =
                  ownItems.length === 0 &&
                  !hasExclusive &&
                  groupCount > 0 &&
                  groupCount < GROUP_CAPACITY &&
                  selectedBono?.serviceType === "grupo_reducido";

                // Disponibilidad: si el entrenador tiene reglas, la franja debe
                // caer dentro; si no tiene ninguna, no se restringe (legacy).
                const withinAvailability =
                  availability.length === 0 ||
                  isHourAvailable(availability, cellDate, h);

                const empty = items.length === 0;
                const bookable =
                  inHours &&
                  withinAvailability &&
                  !!selectedBono &&
                  (empty || groupJoinable);

                // Al unirse, usa la hora EXACTA del grupo ya creado (no la celda).
                const targetSlot = groupJoinable
                  ? new Date(groupItems[0].scheduledAt)
                  : cellDate;

                return (
                  <div
                    key={dayIdx}
                    role={bookable ? "button" : undefined}
                    tabIndex={bookable ? 0 : undefined}
                    onClick={bookable ? () => setSlot(targetSlot) : undefined}
                    onKeyDown={
                      bookable
                        ? (e) => {
                            if (e.key === "Enter") setSlot(targetSlot);
                          }
                        : undefined
                    }
                    className={clsx(
                      "min-h-[3.25rem] border-l border-brand-border p-1 align-top",
                      bookable && "cursor-pointer hover:bg-brand-purple/5",
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      {ownItems.length > 0 ? (
                        ownItems.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOwn(r);
                            }}
                            style={{
                              backgroundColor: `${SERVICE_COLORS[r.serviceType]}1a`,
                              borderLeft: `3px solid ${SERVICE_COLORS[r.serviceType]}`,
                            }}
                            className="block w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-tight"
                          >
                            <span className="block font-bold text-brand-dark">
                              La meva sessió
                            </span>
                            <span
                              className="block truncate"
                              style={{ color: SERVICE_COLORS[r.serviceType] }}
                            >
                              {SERVICE_LABELS[r.serviceType]}
                            </span>
                          </button>
                        ))
                      ) : hasExclusive ? (
                        <span className="block rounded-md bg-brand-border/60 px-1.5 py-1 text-[11px] font-bold text-brand-muted">
                          Ocupat
                        </span>
                      ) : groupCount > 0 ? (
                        groupCount >= GROUP_CAPACITY ? (
                          <span className="block rounded-md bg-brand-border/60 px-1.5 py-1 text-[11px] font-bold text-brand-muted">
                            Grup · Complet
                          </span>
                        ) : (
                          <span
                            style={{
                              backgroundColor: `${groupColor}1a`,
                              borderLeft: `3px solid ${groupColor}`,
                            }}
                            className="block rounded-md px-1.5 py-1 text-[11px] font-bold leading-tight"
                          >
                            <span className="block" style={{ color: groupColor }}>
                              Grup · {groupCount}/{GROUP_CAPACITY}
                            </span>
                            <span className="block font-normal text-brand-muted">
                              {groupJoinable ? "Plaça lliure" : "Grup reduït"}
                            </span>
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Fes clic en una franja lliure per reservar amb el bo seleccionat. Amb un
        bo de grup, també pots apuntar-te a una sessió «Grup» amb plaça lliure.
        Les sessions d&apos;altres persones es mostren com a «Ocupat».
      </p>

      {slot && selectedBono && (
        <CreateModal
          slot={slot}
          bono={selectedBono}
          trainerName={trainerName}
          action={createAction}
          onClose={() => setSlot(null)}
          onDone={() => {
            setSlot(null);
            router.refresh();
          }}
        />
      )}

      {own && (
        <OwnModal
          r={own}
          cancelAction={cancelAction}
          onClose={() => setOwn(null)}
        />
      )}
    </div>
  );
}

function CreateModal({
  slot,
  bono,
  trainerName,
  action,
  onClose,
  onDone,
}: {
  slot: Date;
  bono: ClientReservationData["bonos"][number];
  trainerName: string | null;
  action: CreateAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(slot);

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-bold text-brand-dark">Confirmar reserva</h2>
      <p className="mt-1 text-sm text-brand-muted capitalize">{when}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label="Servei" value={SERVICE_LABELS[bono.serviceType]} />
        {trainerName && <Field label="Entrenador/a" value={trainerName} />}
        <Field label="Sessions restants" value={`${bono.remaining}`} />
      </dl>
      <form action={formAction} className="mt-5">
        <input type="hidden" name="bonoId" value={bono.id} />
        <input type="hidden" name="scheduledAt" value={toLocalInput(slot)} />
        {state.error && (
          <p className="mb-3 text-sm text-error">{state.error}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light"
          >
            Reservar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
          >
            Cancel·lar
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function OwnModal({
  r,
  cancelAction,
  onClose,
}: {
  r: ClientCalendarReservation;
  cancelAction: CancelAction;
  onClose: () => void;
}) {
  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(r.scheduledAt));
  const cancellable =
    r.status === "booked" && new Date(r.scheduledAt).getTime() > Date.now();

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-bold text-brand-dark">La meva sessió</h2>
      <p className="mt-1 text-sm text-brand-muted capitalize">{when}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label="Servei" value={SERVICE_LABELS[r.serviceType]} />
      </dl>
      {cancellable ? (
        <form action={cancelAction} className="mt-5" onSubmit={onClose}>
          <input type="hidden" name="id" value={r.id} />
          <button
            type="submit"
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10"
          >
            Cancel·lar reserva
          </button>
        </form>
      ) : (
        <p className="mt-5 text-sm text-brand-muted">
          Aquesta sessió no es pot cancel·lar.
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
      >
        Tancar
      </button>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
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

function NavBtn({
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
