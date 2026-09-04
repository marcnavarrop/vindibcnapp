"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import {
  SERVICE_LABELS,
  RESERVATION_STATUS_LABELS,
  GROUP_CAPACITY,
  SERVICE_TYPES,
} from "@/lib/labels";
import {
  isHourAvailable,
  isHourBlocked,
  offeredServices,
  type AvailabilityRuleLite,
  type AvailabilityBlockLite,
  type TrainerRuleLite,
  type TrainerBlockLite,
} from "@/lib/availability-slots";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import { colorOfService, type ColorPalette } from "@/lib/colors";
import type { ServiceType } from "@/types/database";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { getOccupancyStatus, OCCUPANCY_COLORS } from "@/lib/group-occupancy";

// Franja horaria por defecto del centro (se amplía si hay reservas fuera).

/** Nom i primer cognom (vista compacta). */
const firstName = (name: string) => name.split(" ").slice(0, 2).join(" ");

/** Icones de servei (SVG inline). */
const SVC_ICON: Record<ServiceType, React.ReactNode> = {
  ep_individual: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="2" /><path d="M1 10c0-3.5 8-3.5 8 0z" />
    </svg>
  ),
  ep_parejas: (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3.5" r="2" /><path d="M0 10c0-3.5 8-3.5 8 0z" />
      <circle cx="9" cy="3.5" r="2" /><path d="M5 10c0-3.5 8-3.5 8 0z" />
    </svg>
  ),
  grupo_reducido: (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="3" r="1.7" /><path d="M0 9.5c0-3 5-3 5 0z" />
      <circle cx="8" cy="3" r="1.7" /><path d="M5 9.5c0-3 6-3 6 0z" />
      <circle cx="13.5" cy="3" r="1.7" /><path d="M11 9.5c0-3 5-3 5 0z" />
    </svg>
  ),
  fisioterapia: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <rect x="0" y="2.5" width="1.5" height="4.5" rx="0.75" />
      <rect x="2" y="0.5" width="1.5" height="6" rx="0.75" />
      <rect x="4" y="0" width="1.5" height="6.5" rx="0.75" />
      <rect x="6" y="0.5" width="1.5" height="6" rx="0.75" />
      <rect x="8" y="2" width="1.5" height="5" rx="0.75" />
      <rect x="0" y="6" width="10" height="4" rx="1.5" />
    </svg>
  ),
};

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
  blocks,
  availabilityLayers,
  layerBlocks = [],
  trials = [],
  manageableTrialIds = [],
  acceptTrialAction,
  rejectTrialAction,
  openingHour = 7,
  closingHour = 22,
  palette,
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
  /** Bloquejos temporals: tapen la disponibilitat setmanal al ombrejat. */
  blocks?: AvailabilityBlockLite[];
  /**
   * Disponibilitat de diversos professionals alhora, cadascun amb el seu color.
   * A la vista del trainer n'hi ha prou amb `availability` (la seva, en verd);
   * aquí n'hi ha diverses superposades i cal saber de qui és cadascuna.
   */
  availabilityLayers?: {
    trainerId: string;
    name: string;
    color: string;
    rules: TrainerRuleLite[];
  }[];
  /** Bloquejos de tots els professionals de `availabilityLayers`. */
  layerBlocks?: TrainerBlockLite[];
  /** Sessions de prova (pending/confirmed) per pintar diferenciades. */
  trials?: TrialHoldItem[];
  manageableTrialIds?: string[];
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
  /** Colors del centre, ja resolts (una sola càrrega per pàgina). */
  palette: ColorPalette;
  /** Horari del centre (configurable per l'admin). */
  openingHour?: number;
  closingHour?: number;
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
    let minH = openingHour;
    let maxH = closingHour;
    for (const r of inWeek) {
      if (r.status === "cancelled") continue;
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
  }, [reservations, trials, weekStart, weekEnd, openingHour, closingHour]);

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
            className={`rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-charcoal hover:bg-brand-bg ${TAP}`}
          >
            Avui
          </button>
          <NavButton label="Setmana següent" onClick={() => setWeekOffset((w) => w + 1)}>
            ›
          </NavButton>
        </div>
        <span className="text-sm font-bold text-brand-dark first-letter:uppercase">
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
                  availability &&
                  isHourAvailable(availability, slot, h) &&
                  !isHourBlocked(blocks ?? [], slot, h);
                // Qui té aquesta franja disponible. Un bloqueig temporal
                // (vacances, baixa) el treu encara que la regla setmanal hi sigui.
                // offeredServices ja té en compte les regles I els bloquejos
                // temporals: si torna buit, aquest professional no hi és.
                const freeHere = (availabilityLayers ?? [])
                  .map((l) => {
                    const svc = offeredServices(
                      l.rules,
                      layerBlocks,
                      l.trainerId,
                      slot,
                      h,
                    );
                    return { ...l, services: SERVICE_TYPES.filter((st) => svc.has(st)) };
                  })
                  .filter((l) => l.services.length > 0);
                // Fins a 2 hi caben nom i servei escrits; de 3 en amunt
                // només un recompte (veure FreeSlotChip).
                const compactFree = freeHere.length === 2;
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
                      "relative cursor-pointer border-l border-brand-border p-1 text-left align-top hover:bg-brand-bg/60 active:bg-brand-bg",
                      TAP_SURFACE,
                      // La fila només creix quan hi ha disponibilitat a pintar:
                      // qui no fa servir la capa no paga l'alçada extra.
                      freeHere.length > 0 ? "min-h-[4.75rem]" : "min-h-[3.25rem]",
                      inAvailability && "bg-emerald-400/10 ring-1 ring-inset ring-emerald-300/40",
                    )}
                    aria-label={`Nova reserva ${DAY_NAMES[dayIdx]} ${pad(h)}:00`}
                    title={
                      freeHere.length
                        ? `Disponible: ${freeHere
                            .map(
                              (l) =>
                                `${l.name} (${l.services
                                  .map((st) => SERVICE_LABELS[st])
                                  .join(", ")})`,
                            )
                            .join(" · ")}`
                        : undefined
                    }
                  >
                    <div className="relative flex flex-col gap-1">
                      {items.map((r) => (
                        <ReservationCard
                          key={r.id}
                          r={r}
                          palette={palette}
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
                      {/* Disponibilitat lliure: sempre DESOTA les reserves,
                          que continuen sent el primer que es llegeix. */}
                      {freeHere.length > 2 ? (
                        <FreeSlotCount layers={freeHere} />
                      ) : (
                        freeHere.map((l) => (
                          <FreeSlotChip
                            key={l.trainerId}
                            name={l.name}
                            color={l.color}
                            services={l.services}
                            compact={compactFree}
                          />
                        ))
                      )}
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
          palette={palette}
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
      className={`block w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-[11px] leading-tight ${TAP_SURFACE}`}
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
        <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">{when}</p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Telèfon</dt>
            <dd className="font-bold text-brand-dark">
              <a href={`tel:${t.phone}`} className={`hover:text-brand-purple ${TAP}`}>
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
                  className={`w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light ${TAP_SURFACE}`}
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
                  className={`w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10 ${TAP_SURFACE}`}
                >
                  Rebutjar
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="mt-5 text-sm text-brand-muted">
            Només el professional d&apos;aquesta prova la pot gestionar.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
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
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold text-brand-charcoal hover:bg-brand-bg ${TAP}`}
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
  palette,
}: {
  r: ReservationListItem;
  canManage: boolean;
  occupancy?: number;
  onClick: (e: React.MouseEvent) => void;
  palette: ColorPalette;
}) {
  const isGroup = r.serviceType === "grupo_reducido" && occupancy != null;
  const status = isGroup ? getOccupancyStatus(occupancy!) : null;
  const oc = status ? OCCUPANCY_COLORS[status] : null;
  const color = colorOfService(palette, r.serviceType);
  const cancelled = r.status === "cancelled";

  return (
    <button
      type="button"
      onClick={onClick}
      style={
        oc
          ? { backgroundColor: oc.bg, borderLeft: `3px solid ${oc.border}` }
          : { backgroundColor: `${color}1a`, borderLeft: `3px solid ${color}` }
      }
      className={clsx(
        "block w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-[11px] leading-tight",
        cancelled && "opacity-50 line-through",
        TAP_SURFACE,
      )}
      title={`${r.clientName} · ${SERVICE_LABELS[r.serviceType]}`}
    >
      <span className="flex items-center gap-1 font-bold text-brand-dark">
        <span className="truncate">{firstName(r.clientName)}</span>
        {!canManage && <LockIcon />}
      </span>
      <span
        className="flex items-center gap-0.5 truncate"
        style={{ color: oc ? oc.text : color }}
      >
        <span className="shrink-0">{SVC_ICON[r.serviceType]}</span>
        {SERVICE_LABELS[r.serviceType]}
        {occupancy != null && ` · ${occupancy}/${GROUP_CAPACITY}`}
        {status === "full" && " · Complet"}
        {status === "almost_full" && " · Gairebé ple"}
      </span>
    </button>
  );
}

/**
 * Franja LLIURE d'un professional.
 *
 * Deliberadament la mateixa forma que una fitxa de reserva, però buida: vora
 * esquerra del color de qui la té lliure i contorn discontinu. Ple = ocupat,
 * contorn = per omplir; així les dues es distingeixen pel pes visual, sense
 * haver de llegir res per saber quina és quina.
 *
 * `compact` és el cas de dos professionals a la mateixa franja: es baixa un
 * punt la mida perquè les dues fitxes hi càpiguen senceres, sense truncar.
 */
function FreeSlotChip({
  name,
  color,
  services,
  compact,
}: {
  name: string;
  color: string;
  services: ServiceType[];
  compact: boolean;
}) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: `${color}14`,
        borderTopColor: `${color}73`,
        borderRightColor: `${color}73`,
        borderBottomColor: `${color}73`,
      }}
      className={clsx(
        "rounded-md border border-dashed px-1.5 leading-tight",
        compact ? "py-[1px]" : "py-0.5",
      )}
    >
      <span
        className={clsx(
          "block truncate font-bold",
          compact ? "text-[10px]" : "text-[11px]",
        )}
        style={{ color }}
      >
        {firstName(name)}
      </span>
      {services.map((st) => (
        <span
          key={st}
          className={clsx(
            "flex items-center gap-0.5 truncate text-brand-muted",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          <span className="shrink-0">{SVC_ICON[st]}</span>
          {SERVICE_LABELS[st]}
        </span>
      ))}
    </div>
  );
}

/**
 * Tres professionals o més a la mateixa franja.
 *
 * Amb tres fitxes no hi cabria cap nom sencer, i truncar-ho tot no diria res.
 * Es diu quants són i de qui, amb un punt del color de cadascun; el detall
 * complet és al `title` de la cel·la i el multicheck permet reduir-los.
 */
function FreeSlotCount({
  layers,
}: {
  layers: { trainerId: string; color: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-dashed border-brand-border bg-brand-bg/60 px-1.5 py-0.5">
      <span className="flex shrink-0 items-center gap-[2px]">
        {layers.map((l) => (
          <span
            key={l.trainerId}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: l.color }}
          />
        ))}
      </span>
      <span className="truncate text-[10px] font-bold text-brand-muted">
        {layers.length} lliures
      </span>
    </div>
  );
}

function ReservationModal({
  r,
  canManage,
  cancelAction,
  completeAction,
  rescheduleAction,
  onClose,
  palette,
}: {
  r: ReservationListItem;
  palette: ColorPalette;
  canManage: boolean;
  cancelAction: ReservationAction;
  completeAction: ReservationAction;
  rescheduleAction: ReservationAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const [done, setDone] = useState<"cancelled" | "completed" | null>(null);

  if (done) {
    const close = () => { router.refresh(); onClose(); };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
          <AnimatedFeedback type={done === "cancelled" ? "cancel" : "success"} />
          <h2 className="text-xl font-bold text-brand-dark">
            {done === "cancelled" ? "Reserva cancel·lada" : "Reserva marcada com feta"}
          </h2>
          <button type="button" onClick={close} className={`mt-2 w-full rounded-lg border border-brand-border px-4 py-2.5 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}>
            Tancar
          </button>
        </div>
      </div>
    );
  }

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
          style={{ backgroundColor: colorOfService(palette, r.serviceType) }}
        />
        <h2 className="text-lg font-bold text-brand-dark">{r.clientName}</h2>
        <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">{when}</p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Field label="Servei" value={SERVICE_LABELS[r.serviceType]} />
          <Field label="Estat" value={RESERVATION_STATUS_LABELS[r.status]} />
          {r.trainerName && <Field label="Professional" value={r.trainerName} />}
        </dl>

        {canManage && (
          <div className="mt-4">
            <AddToCalendarButton
              serviceType={r.serviceType}
              otherPartyName={r.clientName}
              scheduledAt={r.scheduledAt}
            />
          </div>
        )}

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
                  className={`rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-bold text-white hover:opacity-90 ${TAP}`}
                >
                  Desar
                </button>
              </div>
            </form>
            <div className="mt-2 flex items-center gap-2">
              <form action={completeAction} className="flex-1" onSubmit={() => setDone("completed")}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className={`w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light ${TAP_SURFACE}`}
                >
                  Marcar feta
                </button>
              </form>
              <form action={cancelAction} className="flex-1" onSubmit={() => setDone("cancelled")}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className={`w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10 ${TAP_SURFACE}`}
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
          className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
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
