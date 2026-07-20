"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/utils";
import {
  SERVICE_LABELS,
  SERVICE_TYPES,
  GROUP_CAPACITY,
} from "@/lib/labels";
import {
  weekdayOf,
  localDateStr,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import type { ServiceType } from "@/types/database";
import type { FormState } from "@/app/(client)/client/reservas/actions";

const OPEN = 7;
const CLOSE = 22;
const DAY_NAMES = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];

/** Abreviatura visual del tipo de sesión (indicador rápido). */
const SERVICE_BADGE: Record<ServiceType, string> = {
  ep_individual: "Ind",
  ep_parejas: "Par",
  grupo_reducido: "Grup",
  fisioterapia: "Fisio",
};

/** Paleta determinista por profesional (mismo color siempre). */
const PRO_PALETTE = [
  "#642263", // lila de marca
  "#ff6d17", // naranja de acento
  "#1d8a8a", // verd-blau
  "#965495", // lila claro
  "#b45309", // ámbar oscuro
  "#2563eb", // azul
  "#be185d", // magenta
  "#15803d", // verde
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function proColor(id: string | null): string {
  if (!id) return "#8a8f98";
  return PRO_PALETTE[hashStr(id) % PRO_PALETTE.length];
}

type CreateAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;
type CancelAction = (
  prev: { error?: string; ok?: boolean },
  formData: FormData,
) => Promise<{ error?: string; ok?: boolean }>;

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

/** Servicios que un profesional ofrece en (fecha, hora) según sus reglas. */
function offeredServices(
  rules: TrainerRuleLite[],
  trainerId: string,
  date: Date,
  h: number,
): Set<ServiceType> {
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  const out = new Set<ServiceType>();
  for (const r of rules) {
    if (r.trainerId !== trainerId) continue;
    if (r.weekday !== wd) continue;
    if (day < r.validFrom) continue;
    if (r.validUntil && day > r.validUntil) continue;
    if (h < r.startHour || h >= r.endHour) continue;
    for (const s of r.serviceTypes) out.add(s);
  }
  return out;
}

/** Un elemento a pintar en una celda (chip). */
type CellItem =
  | { kind: "own"; id: string; trainerId: string | null; service: ServiceType; slot: Date }
  | { kind: "occupied"; trainerId: string | null; service: ServiceType }
  | {
      kind: "group";
      trainerId: string | null;
      count: number;
      joinable: boolean;
      slot: Date;
    }
  | {
      kind: "free";
      trainerId: string;
      service: ServiceType;
      slot: Date;
    };

export function ClientCenterCalendar({
  data,
  createAction,
  cancelAction,
  minCancellationHours = 0,
}: {
  data: ClientCenterData;
  createAction: CreateAction;
  cancelAction: CancelAction;
  minCancellationHours?: number;
}) {
  const router = useRouter();
  const { bonoTypes, trainers, rules, reservations } = data;

  const [view, setView] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0); // en días (día) o semanas (semana)
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">(
    "all",
  );
  const [trainerFilter, setTrainerFilter] = useState<string | "all">("all");
  const [book, setBook] = useState<{
    trainerId: string;
    service: ServiceType;
    slot: Date;
  } | null>(null);
  const [own, setOwn] = useState<CellItem & { kind: "own" } | null>(null);

  // Vista por defecto según el ancho de pantalla (móvil = diaria).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768)
      setView("day");
  }, []);

  const trainerName = (id: string | null) =>
    trainers.find((t) => t.id === id)?.name ?? "Professional";

  // Índice de reservas por trainer|fecha|hora.
  const resIndex = useMemo(() => {
    const m = new Map<string, ClientCenterData["reservations"]>();
    for (const r of reservations) {
      const d = new Date(r.scheduledAt);
      const key = `${r.trainerId}|${localDateStr(d)}|${d.getHours()}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(r);
    }
    return m;
  }, [reservations]);

  // Días visibles.
  const days = useMemo(() => {
    if (view === "week") {
      const ws = addDays(startOfWeek(new Date()), offset * 7);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    const d = addDays(new Date(), offset);
    d.setHours(0, 0, 0, 0);
    return [d];
  }, [view, offset]);

  // Rango horario a partir de reglas y reservas.
  const hours = useMemo(() => {
    let minH = OPEN;
    let maxH = CLOSE;
    for (const r of rules) {
      minH = Math.min(minH, r.startHour);
      maxH = Math.max(maxH, r.endHour);
    }
    for (const r of reservations) {
      const h = new Date(r.scheduledAt).getHours();
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h + 1);
    }
    const out: number[] = [];
    for (let h = minH; h < maxH; h++) out.push(h);
    return out;
  }, [rules, reservations]);

  // Servicios que puede reservar (bonos), respetando el filtro de servicio.
  const canBook = (s: ServiceType) =>
    bonoTypes.includes(s) && (serviceFilter === "all" || serviceFilter === s);
  const showTrainer = (id: string | null) =>
    trainerFilter === "all" || trainerFilter === id;

  /** Calcula los chips de una celda (fecha, hora). */
  function cellItems(date: Date, h: number): CellItem[] {
    const cellDate = new Date(date);
    cellDate.setHours(h, 0, 0, 0);
    const inFuture = cellDate.getTime() > Date.now();
    const inHours = h >= OPEN && h < CLOSE;
    const day = localDateStr(cellDate);
    const items: CellItem[] = [];

    for (const t of trainers) {
      if (!showTrainer(t.id)) continue;
      const resHere = resIndex.get(`${t.id}|${day}|${h}`) ?? [];
      const ownHere = resHere.filter((r) => r.isOwn);
      const exclusive = resHere.find((r) => r.serviceType !== "grupo_reducido");
      const groupHere = resHere.filter(
        (r) => r.serviceType === "grupo_reducido",
      );
      const offered = offeredServices(rules, t.id, cellDate, h);

      // Mis sesiones (siempre visibles).
      for (const r of ownHere)
        items.push({
          kind: "own",
          id: r.id,
          trainerId: t.id,
          service: r.serviceType,
          slot: new Date(r.scheduledAt),
        });
      if (ownHere.length > 0) continue;

      // Ocupado en exclusiva por otra persona.
      if (exclusive) {
        items.push({
          kind: "occupied",
          trainerId: t.id,
          service: exclusive.serviceType,
        });
        continue;
      }

      // Grupo en marcha.
      if (groupHere.length > 0) {
        const count = groupHere.length;
        const hasFree = count < GROUP_CAPACITY;
        const joinable =
          hasFree && inFuture && inHours && canBook("grupo_reducido");
        items.push({
          kind: "group",
          trainerId: t.id,
          count,
          joinable,
          slot: new Date(groupHere[0].scheduledAt),
        });
        continue;
      }

      // Profesional libre: una franja reservable por cada servicio ofrecido
      // para el que el cliente tenga bono.
      if (inFuture && inHours) {
        for (const s of SERVICE_TYPES) {
          if (offered.has(s) && canBook(s))
            items.push({
              kind: "free",
              trainerId: t.id,
              service: s,
              slot: cellDate,
            });
        }
      }
    }
    return items;
  }

  const periodLabel = useMemo(() => {
    if (view === "week") {
      return new Intl.DateTimeFormat("ca-ES", {
        month: "long",
        year: "numeric",
      }).format(days[0]);
    }
    return new Intl.DateTimeFormat("ca-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(days[0]);
  }, [view, days]);

  const shownTrainers = trainers.filter((t) => showTrainer(t.id));

  return (
    <div>
      {bonoTypes.length === 0 && (
        <p className="mb-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
          No tens cap bo actiu amb sessions disponibles, així que de moment no hi
          ha res reservable. Parla amb el centre per adquirir-ne un.
        </p>
      )}

      {/* Controles: vista + filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-brand-border">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setOffset(0);
              }}
              className={clsx(
                "px-3 py-1.5 text-sm font-bold",
                view === v
                  ? "bg-brand-purple text-white"
                  : "bg-white text-brand-muted hover:text-brand-dark",
              )}
            >
              {v === "day" ? "Dia" : "Setmana"}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-bold tracking-wide text-brand-muted uppercase">
            Servei
          </span>
          <select
            value={serviceFilter}
            onChange={(e) =>
              setServiceFilter(e.target.value as ServiceType | "all")
            }
            className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
          >
            <option value="all">Tots</option>
            {SERVICE_TYPES.filter((s) => bonoTypes.includes(s)).map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-bold tracking-wide text-brand-muted uppercase">
            Professional
          </span>
          <select
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
            className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
          >
            <option value="all">Tots</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Leyenda de profesionales */}
      {shownTrainers.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {shownTrainers.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-charcoal"
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: proColor(t.id) }}
              />
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Navegación */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavBtn
            label="Anterior"
            onClick={() => setOffset((o) => o - 1)}
          >
            ‹
          </NavBtn>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-charcoal hover:bg-brand-bg"
          >
            Avui
          </button>
          <NavBtn label="Següent" onClick={() => setOffset((o) => o + 1)}>
            ›
          </NavBtn>
        </div>
        <span className="text-sm font-bold text-brand-dark capitalize">
          {periodLabel}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <div className={view === "week" ? "min-w-[56rem]" : ""}>
          <div
            className="grid border-b border-brand-border"
            style={{
              gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)`,
            }}
          >
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
                    {DAY_NAMES[weekdayOf(d)]}
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
              className="grid border-b border-brand-border last:border-0"
              style={{
                gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)`,
              }}
            >
              <div className="px-1 py-2 text-right text-xs font-bold text-brand-muted">
                {pad(h)}:00
              </div>
              {days.map((d, dayIdx) => {
                const items = cellItems(d, h);
                return (
                  <div
                    key={dayIdx}
                    className="min-h-[3.25rem] border-l border-brand-border p-1 align-top"
                  >
                    <div className="flex flex-col gap-1">
                      {items.map((it, idx) => {
                        const color = proColor(it.trainerId);
                        if (it.kind === "own") {
                          return (
                            <button
                              key={`own-${it.id}`}
                              type="button"
                              onClick={() => setOwn(it)}
                              style={{
                                backgroundColor: `${color}1a`,
                                borderLeft: `3px solid ${color}`,
                              }}
                              className="block w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-tight"
                            >
                              <span className="block font-bold text-brand-dark">
                                La meva sessió
                              </span>
                              <span className="block truncate text-brand-muted">
                                {SERVICE_BADGE[it.service]} ·{" "}
                                {trainerName(it.trainerId)}
                              </span>
                            </button>
                          );
                        }
                        if (it.kind === "occupied") {
                          return (
                            <span
                              key={`occ-${idx}`}
                              className="block rounded-md bg-brand-border/50 px-1.5 py-1 text-[11px] leading-tight text-brand-muted"
                            >
                              Ocupat
                            </span>
                          );
                        }
                        if (it.kind === "group") {
                          return (
                            <button
                              key={`grp-${idx}`}
                              type="button"
                              disabled={!it.joinable}
                              onClick={
                                it.joinable
                                  ? () =>
                                      setBook({
                                        trainerId: it.trainerId!,
                                        service: "grupo_reducido",
                                        slot: it.slot,
                                      })
                                  : undefined
                              }
                              style={{
                                backgroundColor: `${color}1a`,
                                borderLeft: `3px solid ${color}`,
                              }}
                              className={clsx(
                                "block w-full rounded-md px-1.5 py-1 text-left text-[11px] font-bold leading-tight",
                                it.joinable &&
                                  "cursor-pointer hover:brightness-95",
                              )}
                            >
                              <span className="block" style={{ color }}>
                                Grup · {it.count}/{GROUP_CAPACITY}
                              </span>
                              <span className="block font-normal text-brand-muted">
                                {it.joinable
                                  ? "Plaça lliure"
                                  : it.count >= GROUP_CAPACITY
                                    ? "Complet"
                                    : trainerName(it.trainerId)}
                              </span>
                            </button>
                          );
                        }
                        // free
                        return (
                          <button
                            key={`free-${it.trainerId}-${it.service}`}
                            type="button"
                            onClick={() =>
                              setBook({
                                trainerId: it.trainerId,
                                service: it.service,
                                slot: it.slot,
                              })
                            }
                            style={{
                              backgroundColor: `${color}12`,
                              borderLeft: `3px solid ${color}`,
                            }}
                            className="block w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-[11px] leading-tight hover:brightness-95"
                          >
                            <span
                              className="block font-bold"
                              style={{ color }}
                            >
                              {SERVICE_BADGE[it.service]}
                            </span>
                            <span className="block truncate text-brand-muted">
                              {trainerName(it.trainerId)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Es mostren totes les franjas lliures del centre que pots reservar segons
        els teus bons, amb el color de cada professional. Les sessions d&apos;altres
        persones apareixen com a «Ocupat»; als grups amb plaça pots apuntar-t&apos;hi.
      </p>

      {book && (
        <CreateModal
          trainerId={book.trainerId}
          trainerName={trainerName(book.trainerId)}
          service={book.service}
          slot={book.slot}
          action={createAction}
          onClose={() => setBook(null)}
          onDone={() => {
            setBook(null);
            router.refresh();
          }}
        />
      )}

      {own && (
        <OwnModal
          service={own.service}
          trainerName={trainerName(own.trainerId)}
          id={own.id}
          scheduledAt={own.slot.toISOString()}
          minCancellationHours={minCancellationHours}
          cancelAction={cancelAction}
          onClose={() => setOwn(null)}
        />
      )}
    </div>
  );
}

function CreateModal({
  trainerId,
  trainerName,
  service,
  slot,
  action,
  onClose,
  onDone,
}: {
  trainerId: string;
  trainerName: string;
  service: ServiceType;
  slot: Date;
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
        <Field label="Servei" value={SERVICE_LABELS[service]} />
        <Field label="Professional" value={trainerName} />
      </dl>
      <form action={formAction} className="mt-5">
        <input type="hidden" name="trainerId" value={trainerId} />
        <input type="hidden" name="serviceType" value={service} />
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
  service,
  trainerName,
  id,
  scheduledAt,
  minCancellationHours,
  cancelAction,
  onClose,
}: {
  service: ServiceType;
  trainerName: string;
  id: string;
  scheduledAt: string;
  minCancellationHours: number;
  cancelAction: CancelAction;
  onClose: () => void;
}) {
  const [state, action] = useActionState(cancelAction, {});
  const [confirming, setConfirming] = useState(false);
  const canCancel =
    minCancellationHours === 0 ||
    new Date(scheduledAt).getTime() - Date.now() >=
      minCancellationHours * 60 * 60 * 1000;

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-bold text-brand-dark">La meva sessió</h2>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label="Servei" value={SERVICE_LABELS[service]} />
        <Field label="Professional" value={trainerName} />
      </dl>
      {canCancel ? (
        confirming ? (
          <>
            <p className="mt-5 text-sm font-bold text-brand-dark">
              Segur que vols cancel·lar aquesta reserva?
            </p>
            <div className="mt-3 flex gap-2">
              <form action={action} className="flex-1">
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-error px-3 py-2 text-sm font-bold text-white hover:opacity-80"
                >
                  Sí, cancel·la
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
              >
                No, torna
              </button>
            </div>
            {state.error && (
              <p className="mt-2 text-xs text-error">{state.error}</p>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-5 w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10"
          >
            Cancel·lar reserva
          </button>
        )
      ) : (
        <p className="mt-5 rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
          Ja no es pot cancel·lar aquesta reserva (cal fer-ho amb almenys{" "}
          {minCancellationHours} h d&apos;antelació). Contacta amb el centre si
          tens una urgència.
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
