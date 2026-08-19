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
  offeredServices,
} from "@/lib/availability-slots";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import { Avatar } from "@/components/ui/avatar";
import type { ServiceType } from "@/types/database";
import type { FormState } from "@/app/(client)/client/reservas/actions";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { getOccupancyStatus, OCCUPANCY_COLORS } from "@/lib/group-occupancy";

const DAY_NAMES = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];

/** Abreviatura visual del tipo de sesión (indicador rápido). */
const SERVICE_BADGE: Record<ServiceType, string> = {
  ep_individual: "Individual",
  ep_parejas: "Parella",
  grupo_reducido: "Grup",
  fisioterapia: "Fisioteràpia",
};

/** Icones de servei (SVG inline, ~10 px). */
const SVC_ICON: Record<ServiceType, React.ReactNode> = {
  ep_individual: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="2" />
      <path d="M1 10c0-3.5 8-3.5 8 0z" />
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

/** Primer nom (per a la vista compacta de les fitxes). */
const firstName = (name: string) => name.split(" ")[0];

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

/** Un elemento a pintar en una celda (chip). */
type CellItem =
  | {
      kind: "own";
      id: string;
      trainerId: string | null;
      service: ServiceType;
      slot: Date;
      groupCount?: number;
      /**
       * Noms de pila dels ALTRES del grup, per al detall que s'obre en clicar.
       * A la graella NO hi surten: una cel·la del calendari es veu de lluny i
       * sense voler-ho, i qui hi ha apuntat és cosa de qui obre la sessió.
       */
      mates?: string[];
    }
  | { kind: "occupied"; trainerId: string | null; service: ServiceType }
  | {
      kind: "group";
      trainerId: string | null;
      count: number;
      joinable: boolean;
      slot: Date;
      /** Qui ja s'hi ha apuntat, pel nom de pila. Només per al detall. */
      mates: string[];
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
  openingHour = 7,
  closingHour = 22,
  palette,
}: {
  data: ClientCenterData;
  createAction: CreateAction;
  cancelAction: CancelAction;
  minCancellationHours?: number;
  /** Colors del centre, ja resolts. Es carreguen un cop a la pàgina. */
  palette: ColorPalette;
  /** Horari del centre (configurable per l'admin). */
  openingHour?: number;
  closingHour?: number;
}) {
  const router = useRouter();
  const { bonoTypes, trainers, rules, blocks, reservations, assignedTrainerId } =
    data;

  const [view, setView] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0); // en días (día) o semanas (semana)
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">(
    "all",
  );
  const [trainerFilter, setTrainerFilter] = useState<string | "all">(
    assignedTrainerId ?? "all",
  );
  const [book, setBook] = useState<{
    trainerId: string;
    service: ServiceType;
    slot: Date;
    /** Qui ja hi és, si és un grup. Buit a la resta de serveis. */
    mates?: string[];
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
      if (r.status === "cancelled") continue;
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
    let minH = openingHour;
    let maxH = closingHour;
    for (const r of rules) {
      minH = Math.min(minH, r.startHour);
      maxH = Math.max(maxH, r.endHour);
    }
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const h = new Date(r.scheduledAt).getHours();
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h + 1);
    }
    const out: number[] = [];
    for (let h = minH; h < maxH; h++) out.push(h);
    return out;
  }, [rules, reservations, openingHour, closingHour]);

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
    const inHours = h >= openingHour && h < closingHour;
    const day = localDateStr(cellDate);
    const items: CellItem[] = [];

    // Si ja tens una reserva confirmada a aquesta hora, no mostris noves franges lliures.
    const clientAlreadyBookedThisHour = reservations.some(
      (r) =>
        r.isOwn &&
        r.status !== "cancelled" &&
        localDateStr(new Date(r.scheduledAt)) === day &&
        new Date(r.scheduledAt).getHours() === h,
    );

    for (const t of trainers) {
      if (!showTrainer(t.id)) continue;
      const resHere = resIndex.get(`${t.id}|${day}|${h}`) ?? [];
      const ownHere = resHere.filter((r) => r.isOwn);
      const exclusive = resHere.find((r) => r.serviceType !== "grupo_reducido");
      const groupHere = resHere.filter(
        (r) => r.serviceType === "grupo_reducido",
      );
      const offered = offeredServices(rules, blocks, t.id, cellDate, h);

      // Els noms només existeixen a les reserves de grup: el servidor no els
      // envia per a cap altre servei (vegeu `mateName` a client-calendar.ts).
      const groupMates = (exclude?: string) =>
        groupHere
          .filter((r) => r.id !== exclude)
          .map((r) => r.mateName)
          .filter((n): n is string => !!n);

      // Mis sesiones (siempre visibles).
      for (const r of ownHere)
        items.push({
          kind: "own",
          id: r.id,
          trainerId: t.id,
          service: r.serviceType,
          slot: new Date(r.scheduledAt),
          groupCount: r.serviceType === "grupo_reducido" ? groupHere.length : undefined,
          mates:
            r.serviceType === "grupo_reducido" ? groupMates(r.id) : undefined,
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
          hasFree && inFuture && inHours && canBook("grupo_reducido") && !clientAlreadyBookedThisHour;
        items.push({
          kind: "group",
          trainerId: t.id,
          count,
          joinable,
          mates: groupMates(),
          slot: new Date(groupHere[0].scheduledAt),
        });
        continue;
      }

      // Profesional libre: una franja reservable por cada servicio ofrecido
      // para el que el cliente tenga bono.
      if (inFuture && inHours && !clientAlreadyBookedThisHour) {
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

  // Avís si el professional filtrat no ofereix cap servei que el client pugui reservar.
  const filteredTrainerOffersNothing =
    trainerFilter !== "all" &&
    bonoTypes.length > 0 &&
    !rules.some(
      (r) => r.trainerId === trainerFilter && r.serviceTypes.some((s) => bonoTypes.includes(s)),
    );

  return (
    <div>
      {bonoTypes.length === 0 && (
        <p className="mb-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
          No tens cap bo actiu amb sessions disponibles, així que de moment no hi
          ha res reservable. Parla amb el centre per adquirir-ne un.
        </p>
      )}

      {filteredTrainerOffersNothing && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aquest professional no ofereix cap dels serveis dels teus bons.{" "}
          <button
            type="button"
            onClick={() => setTrainerFilter("all")}
            className="font-bold underline hover:no-underline"
          >
            Mostra tots els professionals
          </button>
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
              {/* La foto substitueix el punt de color; sense foto, el punt
                  segueix sent el cercle amb la inicial del seu color. */}
              <Avatar
                name={t.name}
                url={t.avatarUrl}
                size={18}
                color={colorOfPro(palette, t.id)}
              />
              {firstName(t.name)}
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
                        const color = colorOfPro(palette, it.trainerId);
                        if (it.kind === "own") {
                          // Verd propi coherent amb el semàfor de grups (#16a34a = green-600)
                          const ownBg = "#dcfce7"; // green-100
                          const ownBorder = "#16a34a"; // green-600
                          return (
                            <button
                              key={`own-${it.id}`}
                              type="button"
                              onClick={() => setOwn(it)}
                              style={{
                                backgroundColor: ownBg,
                                border: `2px solid ${ownBorder}`,
                              }}
                              className="block w-full min-w-0 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight"
                            >
                              <span className="flex min-w-0 items-center gap-0.5 font-bold" style={{ color: ownBorder }}>
                                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><polyline points="1.5 5 4 7.5 8.5 2" /></svg>
                                <span className="shrink-0">{SVC_ICON[it.service]}</span>
                                <span className="truncate">{SERVICE_BADGE[it.service]}{it.groupCount != null ? ` · ${it.groupCount}/${GROUP_CAPACITY}` : ""}</span>
                              </span>
                              <span className="block truncate text-brand-muted">
                                {firstName(trainerName(it.trainerId))}
                              </span>
                            </button>
                          );
                        }
                        if (it.kind === "occupied") {
                          return (
                            <span
                              key={`occ-${idx}`}
                              className="flex items-center gap-0.5 rounded-md bg-brand-border/50 px-1.5 py-1 text-[11px] leading-tight text-brand-muted"
                            >
                              <span className="shrink-0 opacity-60">{SVC_ICON[it.service]}</span>
                              Ocupat
                            </span>
                          );
                        }
                        if (it.kind === "group") {
                          const status = getOccupancyStatus(it.count);
                          const oc = OCCUPANCY_COLORS[status];
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
                                        mates: it.mates,
                                      })
                                  : undefined
                              }
                              style={{
                                backgroundColor: oc.bg,
                                borderLeft: `3px solid ${oc.border}`,
                              }}
                              className={clsx(
                                "block w-full rounded-md px-1.5 py-1 text-left text-[11px] font-bold leading-tight",
                                it.joinable
                                  ? "cursor-pointer hover:brightness-95"
                                  : "cursor-not-allowed opacity-80",
                              )}
                            >
                              <span className="block" style={{ color: oc.text }}>
                                Grup · {it.count}/{GROUP_CAPACITY}
                              </span>
                              <span
                                className="block font-normal"
                                style={{ color: oc.text }}
                              >
                                {status === "full"
                                  ? "Complet"
                                  : status === "almost_full"
                                    ? "Gairebé ple"
                                    : "Plaça lliure"}
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
                              className="flex items-center gap-0.5 font-bold"
                              style={{ color }}
                            >
                              <span className="shrink-0">{SVC_ICON[it.service]}</span>
                              {SERVICE_BADGE[it.service]}
                            </span>
                            <span className="block truncate text-brand-muted">
                              {firstName(trainerName(it.trainerId))}
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
        persones apareixen com a «Ocupat»; als grups amb plaça pots apuntar-t&apos;hi,
        i en obrir-los veus qui ja hi és.
      </p>

      {book && (
        <CreateModal
          trainerId={book.trainerId}
          otherPartyName={trainerName(book.trainerId)}
          service={book.service}
          slot={book.slot}
          mates={book.mates}
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
          otherPartyName={trainerName(own.trainerId)}
          mates={own.mates}
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

/**
 * Els companys d'una sessió de grup.
 *
 * NOMÉS es fa servir als diàlegs de detall, mai a la graella: la cel·la del
 * calendari es veu de lluny i sense voler-ho —n'hi ha prou amb passar per
 * davant d'una pantalla—, mentre que obrir la sessió és un gest deliberat.
 * A la graella hi queda el comptador d'ocupació de sempre.
 *
 * No pinta res si la llista és buida, que és el cas de TOTS els serveis que no
 * són 'grupo_reducido': el servidor no els hi envia mai cap nom (vegeu
 * `mateName` a lib/data/client-calendar.ts). Aquí no hi ha cap filtre de
 * privacitat a mantenir, perquè la decisió ja s'ha pres abans d'arribar-hi.
 */
function GroupMates({ mates, label }: { mates: string[]; label: string }) {
  if (mates.length === 0) return null;
  return <Field label={label} value={mates.join(", ")} />;
}

/** Icona animada de feedback (confirmació verda / cancel·lació vermella). */
function CreateModal({
  trainerId,
  otherPartyName: trainerNameFull,
  service,
  slot,
  mates = [],
  action,
  onClose,
  onDone,
}: {
  trainerId: string;
  otherPartyName: string;
  service: ServiceType;
  slot: Date;
  /** Companys de grup ja apuntats. Sempre buit si no és 'grupo_reducido'. */
  mates?: string[];
  action: CreateAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const trainerName = firstName(trainerNameFull);
  const [state, formAction] = useActionState(action, {} as FormState);
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(slot);

  if (state.ok) {
    return (
      <Overlay onClose={onDone}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AnimatedFeedback type="success" />
          <h2 className="text-xl font-bold text-brand-dark">
            Reserva confirmada!
          </h2>
          <p className="text-sm text-brand-muted capitalize">{when}</p>
        </div>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Field label="Servei" value={SERVICE_LABELS[service]} />
          <Field label="Professional" value={trainerName} />
          <GroupMates mates={mates} label="Amb" />
        </dl>
        <div className="mt-5 flex flex-col items-center gap-3">
          <AddToCalendarButton
            serviceType={service}
            otherPartyName={trainerName}
            scheduledAt={slot.toISOString()}
          />
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-bold text-brand-muted hover:text-brand-dark"
          >
            Tancar
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-bold text-brand-dark">Confirmar reserva</h2>
      <p className="mt-1 text-sm text-brand-muted capitalize">{when}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label="Servei" value={SERVICE_LABELS[service]} />
        <Field label="Professional" value={trainerName} />
        <GroupMates mates={mates} label="Ja s'hi han apuntat" />
      </dl>
      <form action={formAction} className="mt-5">
        <input type="hidden" name="trainerId" value={trainerId} />
        <input type="hidden" name="serviceType" value={service} />
        <input type="hidden" name="scheduledAt" value={slot.toISOString()} />
        {state.error && (
          <p className="mb-3 text-sm text-error">{state.error}</p>
        )}
        <div className="flex items-center gap-2">
          {/* Mentre la reserva viatja al servidor hi havia uns segons sense
              cap senyal, i convidaven a tornar a clicar. Ara el botó ho diu i
              es bloqueja, que és el que evita la reserva doble. */}
          <PendingSubmit
            pendingLabel="Reservant…"
            className="flex-1 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-60"
          >
            Reservar
          </PendingSubmit>
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
  otherPartyName: trainerNameFull,
  id,
  scheduledAt,
  mates = [],
  minCancellationHours,
  cancelAction,
  onClose,
}: {
  service: ServiceType;
  otherPartyName: string;
  id: string;
  scheduledAt: string;
  /** Companys de grup. Sempre buit si no és 'grupo_reducido'. */
  mates?: string[];
  minCancellationHours: number;
  cancelAction: CancelAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action] = useActionState(cancelAction, {});
  const [confirming, setConfirming] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    if (state.ok) setCancelled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);
  const canCancel =
    minCancellationHours === 0 ||
    new Date(scheduledAt).getTime() - Date.now() >=
      minCancellationHours * 60 * 60 * 1000;

  if (cancelled) {
    const close = () => { router.refresh(); onClose(); };
    return (
      <Overlay onClose={close}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AnimatedFeedback type="cancel" />
          <h2 className="text-xl font-bold text-brand-dark">Reserva cancel·lada</h2>
          <p className="text-sm text-brand-muted">La sessió ha estat eliminada correctament.</p>
        </div>
        <button
          type="button"
          onClick={close}
          className="mt-5 w-full rounded-lg bg-error/10 px-4 py-2.5 text-sm font-bold text-error hover:bg-error/20"
        >
          Tancar
        </button>
      </Overlay>
    );
  }

  const trainerName = firstName(trainerNameFull);

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-bold text-brand-dark">La meva sessió</h2>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label="Servei" value={SERVICE_LABELS[service]} />
        <Field label="Professional" value={trainerName} />
        <GroupMates mates={mates} label="Amb tu hi ha" />
      </dl>
      <div className="mt-4">
        <AddToCalendarButton
          serviceType={service}
          otherPartyName={trainerNameFull}
          scheduledAt={scheduledAt}
        />
      </div>
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
