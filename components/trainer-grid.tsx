"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import {
  GROUP_CAPACITY,
  SERVICE_LABELS,
  SERVICE_TYPES,
  SESSION_DURATION_MINUTES,
} from "@/lib/labels";
import {
  hourToSlot,
  localDateStr,
  ruleApplies,
  slotToHHMM,
  weekdayOf,
  type TrainerBlockLite,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import { freeServicesAt, occupancyFromSessions } from "@/lib/free-slots";
import {
  SLOT_PX,
  placeByDensity,
  verticalLayout,
  visibleDays,
  type Placed,
} from "@/lib/trainer-grid-layout";
import { colorOfService, type ColorPalette } from "@/lib/colors";
import { ReservationSheet, LockIcon } from "@/components/reservation-sheet";
import { SVC_ICON, TRIAL_COLOR, TrialModal } from "@/components/weekly-calendar";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type { SessionNote } from "@/lib/data/session-notes";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import type { AgendaNav } from "@/lib/agenda-window";
import type { OwnBlock } from "@/lib/data/availability-blocks";
import type { ServiceType } from "@/types/database";

/*
 * LA REJILLA DEL PROFESSIONAL.
 *
 * Substitueix, NOMÉS a /trainer/reservas, el calendari setmanal de sempre
 * (`weekly-calendar.tsx`), que l'admin segueix fent servir tal com és fins que
 * li toqui a ell. La geometria —quins dies, quines hores, com es reparteix
 * l'amplada— viu a `lib/trainer-grid-layout.ts` i té la seva comprovació.
 *
 *   · Una sola rejilla: capçalera de dies enganxada a dalt i columna d'hores.
 *   · Sessions a escala: 60 min són un bloc de 80 px, no dues files.
 *   · Un grup és UNA targeta, amb l'ocupació i els noms.
 *   · Els forats lliures diuen quins serveis hi caben, amb la regla del
 *     servidor (`freeServicesAt`): el verd ja no és l'horari, és el que es pot
 *     reservar de debò.
 *   · El passat, atenuat; una línia taronja marca ara.
 *   · Al mòbil, tres dies a partir d'avui (o de `?dia=`); a l'escriptori, la
 *     setmana. Les dues rejilles són al DOM i el CSS n'ensenya una: sense
 *     esperar a saber l'amplada, no hi ha salt en carregar.
 */

type ReservationAction = (formData: FormData) => void | Promise<void>;
type StatefulReservationAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;

const SHORT: Record<ServiceType, string> = {
  ep_individual: "Ind",
  ep_parejas: "Par",
  grupo_reducido: "Grup",
  fisioterapia: "Fisio",
};
const DOW = ["dl", "dt", "dc", "dj", "dv", "ds", "dg"];
const FREE_COLOR = "#16a34a"; // green-600: el mateix verd de "lliure" de l'app

const dayFmt = new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("ca-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Slot amb decimals d'un instant, en hora del navegador. */
function slotFloat(d: Date): number {
  return (d.getHours() * 60 + d.getMinutes()) / 30;
}
const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
/** «Núria S.»: el nom i la inicial, perquè a 100 px no calgui tallar res. */
function shortName(name: string): string {
  const [first, second] = name.trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : first;
}
function initials(name: string): string {
  const [first, second] = name.trim().split(/\s+/);
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
}

/** Una cosa que ocupa temps en una columna. */
type Entry =
  | { kind: "res"; id: string; start: Date; end: Date; own: boolean; r: ReservationListItem }
  | {
      kind: "group";
      id: string;
      start: Date;
      end: Date;
      own: boolean;
      list: ReservationListItem[];
    }
  | { kind: "trial"; id: string; start: Date; end: Date; own: boolean; t: TrialHoldItem };

/** Un tram de forats lliures seguits amb els mateixos serveis. */
type FreeRun = { from: number; to: number; lastStart: number; services: ServiceType[] };

type DayInfo = {
  date: Date;
  key: string;
  entries: Entry[];
  rules: TrainerRuleLite[];
  free: FreeRun[];
  /** Els bloquejos propis d'aquest dia, en slots amb decimals, amb el motiu. */
  blocks: { from: number; to: number; reason: string | null }[];
  /** Gent en espera per sessió pròpia: instant (ms) → quants. */
  waiting: Map<number, number>;
};

export function TrainerGrid({
  nav,
  reservations,
  occupancyReservations,
  trials,
  myTrainerId,
  rules,
  blocks,
  ownBlocks,
  waiting,
  showFree,
  manageableIds,
  cancellableIds,
  noteableIds,
  notes,
  clientBase,
  newReservationBase,
  cancelAction,
  completeAction,
  rescheduleAction,
  manageableTrialIds,
  acceptTrialAction,
  rejectTrialAction,
  palette,
  openingHour,
  closingHour,
}: {
  nav: AgendaNav;
  /** Les que es pinten: les pròpies i les dels companys triats. */
  reservations: ReservationListItem[];
  /** TOTES les de la finestra: els forats lliures es calculen contra aquestes. */
  occupancyReservations: ReservationListItem[];
  trials: TrialHoldItem[];
  myTrainerId: string;
  /** Les regles de disponibilitat PRÒPIES. */
  rules: TrainerRuleLite[];
  blocks: TrainerBlockLite[];
  /** Els bloquejos PROPIS amb el motiu (els dels companys no el porten). */
  ownBlocks: OwnBlock[];
  /** Quanta gent espera plaça a cada sessió pròpia (instant ISO). */
  waiting: { at: string; count: number }[];
  showFree: boolean;
  manageableIds: string[];
  cancellableIds: string[];
  noteableIds: string[];
  notes?: Record<string, SessionNote>;
  clientBase: string;
  newReservationBase: string;
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
  rescheduleAction: ReservationAction;
  manageableTrialIds: string[];
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
  palette: ColorPalette;
  openingHour: number;
  closingHour: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReservationListItem | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<TrialHoldItem | null>(null);
  const [list, setList] = useState<{ title: string; entries: Entry[] } | null>(null);
  const [showAll, setShowAll] = useState(false);

  /*
   * NOMÉS AL NAVEGADOR. La rejilla pinta en l'hora del navegador (com el
   * calendari de sempre) i el servidor no la sap: si la pintés ell, les
   * sessions podrien caure una o dues hores desplaçades i React hauria de
   * refer-ho tot en arribar. Fins que no és al navegador, un espai reservat.
   */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const manageable = useMemo(() => new Set(manageableIds), [manageableIds]);
  const waitingByMs = useMemo(
    () => new Map(waiting.map((w) => [new Date(w.at).getTime(), w.count])),
    [waiting],
  );
  const cancellable = useMemo(() => new Set(cancellableIds), [cancellableIds]);
  const noteable = useMemo(() => new Set(noteableIds), [noteableIds]);
  const manageableTrials = useMemo(() => new Set(manageableTrialIds), [manageableTrialIds]);

  // Ocupació per als forats lliures (PR 1): reserves vives i proves actives.
  const occupancy = useMemo(
    () =>
      occupancyFromSessions([
        ...occupancyReservations
          .filter((r) => r.status === "booked")
          .map((r) => ({ trainerId: r.trainerId, scheduledAt: r.scheduledAt, serviceType: r.serviceType })),
        ...trials.map((t) => ({ trainerId: t.trainerId, scheduledAt: t.scheduledAt, serviceType: t.serviceType })),
      ]),
    [occupancyReservations, trials],
  );

  // Les entrades de cada dia: un grup és una sola entrada.
  const entriesByDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    const push = (key: string, e: Entry) => (m.get(key) ?? m.set(key, []).get(key)!).push(e);
    const groups = new Map<string, ReservationListItem[]>();
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const start = new Date(r.scheduledAt);
      if (r.serviceType === "grupo_reducido") {
        const k = `${r.trainerId}|${r.scheduledAt}`;
        (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
        continue;
      }
      push(localDateStr(start), {
        kind: "res",
        id: r.id,
        start,
        end: new Date(start.getTime() + SESSION_DURATION_MINUTES * 60_000),
        own: r.trainerId === myTrainerId,
        r,
      });
    }
    for (const [k, list] of groups) {
      const start = new Date(list[0].scheduledAt);
      push(localDateStr(start), {
        kind: "group",
        id: `g:${k}`,
        start,
        end: new Date(start.getTime() + SESSION_DURATION_MINUTES * 60_000),
        own: list[0].trainerId === myTrainerId,
        list: [...list].sort((a, b) => a.clientName.localeCompare(b.clientName)),
      });
    }
    for (const t of trials) {
      const start = new Date(t.scheduledAt);
      push(localDateStr(start), {
        kind: "trial",
        id: `t:${t.id}`,
        start,
        end: new Date(start.getTime() + SESSION_DURATION_MINUTES * 60_000),
        own: t.trainerId === myTrainerId,
        t,
      });
    }
    return m;
  }, [reservations, trials, myTrainerId]);

  const info = (date: Date): DayInfo => {
    const key = localDateStr(date);
    const wd = weekdayOf(date);
    const dayRules = rules.filter((r) => ruleApplies(r, key, wd));
    const free: FreeRun[] = [];
    if (showFree && now) {
      const starts: { slot: number; services: ServiceType[] }[] = [];
      for (const r of dayRules)
        for (let slot = r.startSlot; slot < r.endSlot; slot++) {
          const at = new Date(date);
          at.setHours(0, slot * 30, 0, 0);
          if (at.getTime() <= now.getTime()) continue;
          // Un grup amb plaça no és "lliure": ja té la seva targeta amb 2/4.
          if (occupancy(myTrainerId, at, SESSION_DURATION_MINUTES).length) continue;
          const svc = freeServicesAt({
            rules,
            blocks,
            trainerId: myTrainerId,
            date,
            slot,
            durationMinutes: SESSION_DURATION_MINUTES,
            occupancy,
          });
          if (svc.size) starts.push({ slot, services: SERVICE_TYPES.filter((s) => svc.has(s)) });
        }
      const uniq = [...new Map(starts.map((s) => [s.slot, s])).values()].sort((a, b) => a.slot - b.slot);
      for (const s of uniq) {
        const last = free[free.length - 1];
        if (last && last.lastStart === s.slot - 1 && last.services.join() === s.services.join()) {
          last.lastStart = s.slot;
        } else {
          free.push({ from: s.slot, to: s.slot, lastStart: s.slot, services: s.services });
        }
      }
      // Fins on arriba cada tram: la sessió que hi comenci més tard acaba una
      // hora després, sense trepitjar el tram següent.
      free.forEach((f, i) => {
        const next = free[i + 1]?.from ?? Infinity;
        f.to = Math.min(f.lastStart + 2, next);
      });
    }
    // Els bloquejos propis, retallats al dia.
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);
    const dayBlocks = ownBlocks
      .map((b) => ({ s: new Date(b.startAt), e: new Date(b.endAt), reason: b.reason }))
      .filter((b) => b.s < dayEnd && b.e > dayStart)
      .map((b) => ({
        from: b.s <= dayStart ? 0 : slotFloat(b.s),
        to: b.e >= dayEnd ? 48 : slotFloat(b.e),
        reason: b.reason,
      }));
    return {
      date,
      key,
      entries: entriesByDay.get(key) ?? [],
      rules: dayRules,
      free,
      blocks: dayBlocks,
      waiting: waitingByMs,
    };
  };
  const hasSomething = (d: Date) => {
    const i = info(d);
    return i.entries.length > 0 || i.rules.length > 0;
  };

  const weekDays = visibleDays(
    Array.from({ length: 7 }, (_, i) => addDays(parseDay(nav.weekStart), i)),
    weekdayOf,
    hasSomething,
    showAll,
  );
  const mobileDays = visibleDays(
    Array.from({ length: 10 }, (_, i) => addDays(parseDay(nav.dayStart), i)),
    weekdayOf,
    hasSomething,
    showAll,
  ).slice(0, 3);

  // Enllaços de la finestra del mòbil. Endavant: el dia després de l'últim
  // que es veu. Enrere: tres dies feiners enrere (el cap de setmana, si té
  // alguna cosa, hi surt igualment en arribar).
  const dayHref = (d: Date) => `${nav.basePath}?dia=${localDateStr(d)}`;
  const nextStart = addDays(mobileDays[mobileDays.length - 1] ?? parseDay(nav.dayStart), 1);
  let prevStart = parseDay(nav.dayStart);
  for (let n = 0; n < 3; ) {
    prevStart = addDays(prevStart, -1);
    if (weekdayOf(prevStart) < 5) n++;
  }

  const goNew = (at: Date) => {
    const params = new URLSearchParams({ at: toLocalInput(at), trainer: myTrainerId });
    router.push(`${newReservationBase}?${params}`);
  };

  const open = (e: Entry) => {
    if (e.kind === "res") setSelected(e.r);
    else if (e.kind === "trial") setSelectedTrial(e.t);
    else
      setList({
        title: `Grup · ${hhmm(e.start)} · ${e.list.length}/${GROUP_CAPACITY}${
          e.own && waitingByMs.get(e.start.getTime())
            ? ` · +${waitingByMs.get(e.start.getTime())} en espera`
            : ""
        }`,
        entries: e.list.map((r) => ({
          kind: "res" as const,
          id: r.id,
          start: e.start,
          end: e.end,
          own: e.own,
          r,
        })),
      });
  };

  const gridProps = {
    now,
    info,
    showAll,
    openingHour,
    closingHour,
    palette,
    manageable,
    todayKey: now ? localDateStr(now) : "",
    onOpen: open,
    onMore: (title: string, entries: Entry[]) => setList({ title, entries }),
    onNew: goNew,
  };

  const showAllButton = (
    <button
      type="button"
      onClick={() => setShowAll((v) => !v)}
      aria-pressed={showAll}
      className={clsx(
        "rounded-lg border px-3 py-1.5 text-sm font-bold",
        showAll
          ? "border-brand-purple bg-brand-purple text-white"
          : "border-brand-border bg-white text-brand-charcoal hover:bg-brand-bg",
        TAP,
      )}
    >
      {showAll ? "Només el que hi ha" : "Mostrar-ho tot"}
    </button>
  );

  return (
    <div>
      {/* ── Mòbil: tres dies ─────────────────────────────────────────────── */}
      <div className="md:hidden" data-grid="mobile">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NavLink label="Dies anteriors" href={dayHref(prevStart)}>‹</NavLink>
            <Link
              href={nav.basePath}
              aria-current={nav.dayStart === nav.today ? "page" : undefined}
              className={`flex h-11 items-center rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-charcoal hover:bg-brand-bg ${TAP}`}
            >
              Avui
            </Link>
            <NavLink label="Dies següents" href={dayHref(nextStart)}>›</NavLink>
          </div>
          {showAllButton}
        </div>
        {now ? (
          <Grid {...gridProps} days={mobileDays} />
        ) : (
          <GridPlaceholder />
        )}
      </div>

      {/* ── Escriptori: la setmana ───────────────────────────────────────── */}
      <div className="hidden md:block" data-grid="desktop">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <NavLink label="Setmana anterior" href={nav.href.prevWeek}>‹</NavLink>
            <Link
              href={nav.href.today}
              aria-current={nav.isCurrentWeek ? "page" : undefined}
              className={`flex h-9 items-center rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-charcoal hover:bg-brand-bg ${TAP}`}
            >
              Avui
            </Link>
            <NavLink label="Setmana següent" href={nav.href.nextWeek}>›</NavLink>
            <span className="ml-2 text-sm font-bold text-brand-dark">
              {dayFmt.format(parseDay(nav.weekStart))} – {dayFmt.format(addDays(parseDay(nav.weekStart), 6))}
            </span>
          </div>
          {showAllButton}
        </div>
        {now ? <Grid {...gridProps} days={weekDays} /> : <GridPlaceholder />}
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Toca un forat lliure per crear-hi una reserva, o una sessió per obrir-ne la fitxa.
      </p>

      {selected && (
        <ReservationSheet
          r={selected}
          palette={palette}
          canManage={manageable.has(selected.id)}
          canCancel={cancellable.has(selected.id)}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          note={notes?.[selected.id] ?? null}
          canWriteNote={noteable.has(selected.id)}
          clientHref={`${clientBase}/${selected.clientId}`}
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
      {list && (
        <EntryListSheet
          title={list.title}
          entries={list.entries}
          palette={palette}
          manageable={manageable}
          onPick={(e) => {
            setList(null);
            open(e);
          }}
          onClose={() => setList(null)}
        />
      )}
    </div>
  );
}

function GridPlaceholder() {
  return (
    <div
      aria-busy="true"
      className="h-96 animate-pulse rounded-xl border border-brand-border bg-white"
    />
  );
}

function NavLink({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold text-brand-charcoal hover:bg-brand-bg md:h-9 md:w-9 ${TAP}`}
    >
      {children}
    </Link>
  );
}

function Grid({
  days,
  now,
  info,
  showAll,
  openingHour,
  closingHour,
  palette,
  manageable,
  todayKey,
  onOpen,
  onMore,
  onNew,
}: {
  days: Date[];
  now: Date | null;
  info: (d: Date) => DayInfo;
  showAll: boolean;
  openingHour: number;
  closingHour: number;
  palette: ColorPalette;
  manageable: Set<string>;
  todayKey: string;
  onOpen: (e: Entry) => void;
  onMore: (title: string, entries: Entry[]) => void;
  onNew: (at: Date) => void;
}) {
  const dayInfos = days.map(info);

  // Els slots on passa alguna cosa en algun dels dies que es veuen.
  const active = new Set<number>();
  for (const d of dayInfos) {
    for (const r of d.rules) for (let s = r.startSlot; s < r.endSlot; s++) active.add(s);
    for (const e of d.entries) {
      const a = Math.floor(slotFloat(e.start));
      const b = Math.ceil(slotFloat(e.end) || 48);
      for (let s = a; s < b; s++) active.add(s);
    }
  }
  const v = verticalLayout(active, hourToSlot(openingHour), hourToSlot(closingHour), showAll);
  const cols = `3rem repeat(${days.length}, minmax(0, 1fr))`;
  const nowSlot = now ? slotFloat(now) : -1;
  // La línia d'ara només si avui és un dels dies que es veuen.
  const nowVisible =
    now && dayInfos.some((d) => d.key === todayKey) && nowSlot >= v.from && nowSlot <= v.to;

  return (
    <div className="rounded-xl border border-brand-border bg-white">
      {/* Capçalera enganxada: sota la barra del mòbil (60 px), a dalt a
          l'escriptori, on la barra no hi és. */}
      <div
        className="sticky top-[60px] z-20 grid rounded-t-xl border-b border-brand-border bg-white lg:top-0"
        style={{ gridTemplateColumns: cols }}
      >
        <div />
        {dayInfos.map((d) => {
          const isToday = d.key === todayKey;
          const past = d.key < todayKey;
          const own = d.entries.filter((e) => e.own && e.kind !== "trial").length;
          return (
            <div
              key={d.key}
              data-day={d.key}
              className={clsx(
                "border-l border-brand-border px-1 py-2 text-center",
                past && "text-brand-muted/70",
              )}
            >
              <div className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                {DOW[weekdayOf(d.date)]}
              </div>
              <div
                className={clsx(
                  "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                  isToday ? "bg-brand-orange text-white" : "text-brand-dark",
                )}
              >
                {d.date.getDate()}
              </div>
              <div className="mt-0.5 text-xs text-brand-muted">
                {own === 0 ? "—" : `${own} ${own === 1 ? "sessió" : "ses."}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative grid" style={{ gridTemplateColumns: cols, height: v.height }}>
        {/* Columna d'hores */}
        <div className="relative">
          {v.segments.map((g) =>
            g.kind === "fold" ? (
              <div
                key={`f${g.from}`}
                className="absolute inset-x-0 flex items-center justify-end pr-1 text-xs text-brand-muted"
                style={{ top: g.top, height: 28 }}
              >
                {slotToHHMM(g.from).slice(0, 2)}–{slotToHHMM(g.to).slice(0, 2)}
              </div>
            ) : (
              Array.from({ length: g.to - g.from }, (_, i) => g.from + i)
                .filter((s) => s % 2 === 0)
                .map((s) => (
                  <div
                    key={s}
                    className="absolute right-1 -translate-y-1/2 text-xs font-bold text-brand-muted"
                    style={{ top: Math.max(8, v.y(s)) }}
                  >
                    {slotToHHMM(s)}
                  </div>
                ))
            ),
          )}
          {nowVisible && (
            <div
              className="absolute right-0.5 z-10 -translate-y-1/2 rounded bg-brand-orange px-1 text-xs font-bold text-white"
              style={{ top: v.y(nowSlot) }}
            >
              {hhmm(now!)}
            </div>
          )}
        </div>

        {/* Bandes plegades, a tot l'ample de les columnes */}
        {v.segments
          .filter((g) => g.kind === "fold")
          .map((g) => (
            <div
              key={`fb${g.from}`}
              className="pointer-events-none absolute right-0 left-12 flex items-center justify-center border-y border-brand-border bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(0,0,0,0.035)_6px,rgba(0,0,0,0.035)_12px)] text-xs text-brand-muted"
              style={{ top: g.top, height: 28 }}
            >
              fora de la jornada
            </div>
          ))}

        {dayInfos.map((d) => (
          <DayColumn
            key={d.key}
            d={d}
            v={v}
            now={now}
            isToday={d.key === todayKey}
            isPast={d.key < todayKey}
            palette={palette}
            manageable={manageable}
            onOpen={onOpen}
            onMore={onMore}
            onNew={onNew}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  d,
  v,
  now,
  isToday,
  isPast,
  palette,
  manageable,
  onOpen,
  onMore,
  onNew,
}: {
  d: DayInfo;
  v: ReturnType<typeof verticalLayout>;
  now: Date | null;
  isToday: boolean;
  isPast: boolean;
  palette: ColorPalette;
  manageable: Set<string>;
  onOpen: (e: Entry) => void;
  onMore: (title: string, entries: Entry[]) => void;
  onNew: (at: Date) => void;
}) {
  const placed = placeByDensity(
    d.entries.map((e) => ({ id: e.id, start: e.start.getTime(), end: e.end.getTime(), own: e.own })),
  );
  const byId = new Map(d.entries.map((e) => [e.id, e]));
  const nowY = now ? v.y(slotFloat(now)) : 0;
  const box = (fromSlot: number, toSlot: number) => {
    const top = v.y(fromSlot);
    return { top: top + 1, height: Math.max(v.y(toSlot) - top - 2, 44) };
  };
  const lanes = (p: Placed) =>
    p.lanes === 2
      ? { left: p.lane === 0 ? "2px" : "calc(50% + 1px)", width: "calc(50% - 3px)" }
      : { left: "2px", width: "calc(100% - 4px)" };

  return (
    <div data-day-col={d.key} className="relative border-l border-brand-border">
      {/* Línies de les hores (la de mitja hora, més fluixa) */}
      {v.segments
        .filter((g) => g.kind === "hours")
        .flatMap((g) =>
          Array.from({ length: g.to - g.from }, (_, i) => g.from + i).map((s) => (
            <div
              key={s}
              className={clsx(
                "pointer-events-none absolute inset-x-0 border-t",
                s % 2 === 0 ? "border-brand-border" : "border-dashed border-brand-border/50",
              )}
              style={{ top: v.y(s) }}
            />
          )),
        )}

      {/* El passat, atenuat */}
      {(isPast || isToday) && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-brand-bg/70"
          style={{ height: isPast ? v.height : nowY }}
        />
      )}

      {/* Bloquejos propis: ratllats i amb el motiu. No es toquen: no hi ha res
          a fer-hi des d'aquí (es gestionen a Disponibilitat). */}
      {d.blocks.map((bl) => {
        const from = Math.max(bl.from, v.from);
        const to = Math.min(bl.to, v.to);
        if (to <= from) return null;
        const top = v.y(from);
        const height = v.y(to) - top;
        const text = bl.reason ? `Bloquejat · ${bl.reason}` : "Bloquejat";
        return (
          <div
            key={`block-${bl.from}`}
            data-block={d.key}
            role="note"
            aria-label={`${text}, de ${slotToHHMM(Math.floor(bl.from))} a ${slotToHHMM(Math.ceil(bl.to) % 48)}`}
            title={text}
            className="pointer-events-none absolute inset-x-0.5 rounded-md border border-brand-muted/30 bg-[repeating-linear-gradient(135deg,rgba(100,34,99,0.10),rgba(100,34,99,0.10)_5px,transparent_5px,transparent_10px)] px-1.5 py-1"
            style={{ top: top + 1, height: Math.max(height - 2, 4) }}
          >
            {height >= 24 && (
              <span className="inline-block rounded bg-white/90 px-1 text-xs font-bold text-brand-dark">
                {text}
              </span>
            )}
          </div>
        );
      })}

      {/* Forats lliures, amb els serveis que hi caben */}
      {d.free.map((f) => {
        const b = box(f.from, f.to);
        const startAt = new Date(d.date);
        startAt.setHours(0, f.from * 30, 0, 0);
        const label = `Lliure ${slotToHHMM(f.from)}–${slotToHHMM(f.to)}`;
        return (
          <button
            key={`free-${f.from}`}
            type="button"
            data-free={`${d.key} ${slotToHHMM(f.from)}`}
            aria-label={`Nova reserva ${longDayFmt.format(d.date)}, ${label.toLowerCase()}: ${f.services
              .map((s) => SERVICE_LABELS[s])
              .join(", ")}`}
            onClick={(e) => {
              // On s'ha tocat dins del tram diu a quina mitja hora.
              const rect = e.currentTarget.getBoundingClientRect();
              const k = Math.min(Math.floor((e.clientY - rect.top) / SLOT_PX), f.lastStart - f.from);
              const at = new Date(startAt);
              at.setMinutes(at.getMinutes() + Math.max(0, k) * 30);
              onNew(at);
            }}
            className={clsx(
              "absolute inset-x-0.5 flex flex-col items-start gap-0.5 rounded-md border border-dashed px-1.5 py-1 text-left",
              "hover:bg-emerald-50 active:bg-emerald-100",
              TAP_SURFACE,
            )}
            style={{ ...b, borderColor: `${FREE_COLOR}80`, backgroundColor: `${FREE_COLOR}0d` }}
          >
            <span className="text-xs font-bold" style={{ color: FREE_COLOR }}>
              Lliure
            </span>
            <span className="flex flex-wrap gap-x-1 text-xs text-brand-charcoal">
              {f.services.map((s) => (
                <span key={s} className="flex items-center gap-0.5">
                  <span style={{ color: colorOfService(palette, s) }}>{SVC_ICON[s]}</span>
                  {SHORT[s]}
                </span>
              ))}
            </span>
          </button>
        );
      })}

      {/* Sessions, grups i proves, segons la densitat */}
      {placed.map((p) => {
        if (p.kind === "more") {
          const entries = p.ids.map((id) => byId.get(id)!).filter(Boolean);
          const b = box(slotFloat(new Date(p.start)), slotFloat(new Date(p.end)) || 48);
          return (
            <button
              key={`more-${p.ids.join()}`}
              type="button"
              data-more={p.ids.length}
              onClick={() => onMore(`${hhmm(new Date(p.start))} · ${entries.length} més`, entries)}
              aria-label={`${entries.length} sessions més a les ${hhmm(new Date(p.start))}`}
              className={clsx(
                "absolute z-10 flex flex-col items-center justify-center rounded-md border border-brand-border bg-white text-xs font-bold text-brand-dark shadow-sm hover:bg-brand-bg",
                TAP_SURFACE,
              )}
              style={{ ...b, ...lanes(p) }}
            >
              <span className="text-sm">+{entries.length}</span>
              <span className="font-normal text-brand-muted">més</span>
            </button>
          );
        }
        const e = byId.get(p.id)!;
        const b = box(slotFloat(e.start), slotFloat(e.end) || 48);
        const past = now ? e.end.getTime() <= now.getTime() : false;
        // «Per marcar»: ja ha passat, segueix reservada i la pots marcar tu.
        const toMark =
          past &&
          (e.kind === "res"
            ? e.r.status === "booked" && manageable.has(e.r.id)
            : e.kind === "group"
              ? e.list.some((r) => r.status === "booked" && manageable.has(r.id))
              : false);
        const series =
          e.kind === "res" ? !!e.r.seriesId : e.kind === "group" ? e.list.some((r) => !!r.seriesId) : false;
        const waitingN =
          e.kind === "group" && e.own && !past ? (d.waiting.get(e.start.getTime()) ?? 0) : 0;
        return (
          <EntryCard
            key={e.id}
            e={e}
            level={p.level}
            past={past}
            toMark={toMark}
            series={series}
            waiting={waitingN}
            palette={palette}
            locked={e.kind === "res" ? !manageable.has(e.r.id) : e.kind === "group" ? !manageable.has(e.list[0].id) : !e.own}
            style={{ ...b, ...lanes(p) }}
            onClick={() => onOpen(e)}
          />
        );
      })}

      {/* Ara */}
      {isToday && now && nowY > 0 && nowY < v.height && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-brand-orange"
          style={{ top: nowY }}
        >
          <span className="absolute -top-[5px] -left-[5px] h-2 w-2 rounded-full bg-brand-orange" />
        </div>
      )}
    </div>
  );
}

function EntryCard({
  e,
  level,
  past,
  toMark = false,
  series = false,
  waiting = 0,
  palette,
  locked,
  style,
  onClick,
}: {
  e: Entry;
  level: 1 | 2 | 3;
  past: boolean;
  /** Passada, reservada encara i la pots marcar: vora taronja i «Per marcar». */
  toMark?: boolean;
  /** Forma part d'una sèrie: ↻. */
  series?: boolean;
  /** Gent a la llista d'espera d'aquest grup. */
  waiting?: number;
  palette: ColorPalette;
  locked: boolean;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const compact = level > 1;
  const time = hhmm(e.start);

  if (e.kind === "trial") {
    const pending = e.t.status === "pending";
    return (
      <button
        type="button"
        onClick={onClick}
        data-entry={e.id}
        aria-label={`${time} · Prova · ${e.t.fullName} · ${pending ? "Pendent" : "Confirmada"}`}
        className={clsx(
          "absolute z-10 flex flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left text-xs",
          past && "opacity-60",
          TAP_SURFACE,
        )}
        style={{
          ...style,
          backgroundColor: `${TRIAL_COLOR}1a`,
          border: `1.5px ${pending ? "dashed" : "solid"} ${TRIAL_COLOR}`,
        }}
      >
        <span className="rounded px-1 font-bold text-white" style={{ backgroundColor: TRIAL_COLOR }}>
          {compact ? "P" : "PROVA"}
        </span>
        {compact ? (
          <span className="font-bold text-brand-dark">{initials(e.t.fullName)}</span>
        ) : (
          <>
            <span className="font-bold break-words text-brand-dark">{shortName(e.t.fullName)}</span>
            <span style={{ color: TRIAL_COLOR }}>{pending ? "Pendent" : "Confirmada"}</span>
          </>
        )}
      </button>
    );
  }

  const service: ServiceType = e.kind === "res" ? e.r.serviceType : "grupo_reducido";
  const color = colorOfService(palette, service);
  const trainer = e.kind === "res" ? e.r.trainerName : e.list[0].trainerName;
  const tight = toMark || waiting > 0;
  const extra = [
    series ? "sèrie" : "",
    toMark ? "per marcar" : "",
    waiting ? `${waiting} en espera` : "",
  ].filter(Boolean);
  const label =
    (e.kind === "res"
      ? `${time} · ${e.r.clientName} · ${SERVICE_LABELS[service]}${trainer ? ` · ${trainer}` : ""}`
      : `${time} · Grup ${e.list.length}/${GROUP_CAPACITY}: ${e.list.map((r) => r.clientName).join(", ")}`) +
    (extra.length ? ` · ${extra.join(" · ")}` : "");

  return (
    <button
      type="button"
      onClick={onClick}
      data-entry={e.id}
      aria-label={label}
      data-to-mark={toMark || undefined}
      className={clsx(
        "absolute z-10 flex flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left text-xs leading-tight",
        // El que està per marcar no s'atenua: és feina pendent, no història.
        past && !toMark && "opacity-60",
        toMark && "ring-2 ring-brand-orange ring-inset",
        TAP_SURFACE,
      )}
      style={{ ...style, backgroundColor: `${color}1f`, borderLeft: `3px solid ${color}` }}
    >
      {compact ? (
        <>
          <span className="flex items-center gap-0.5 font-bold text-brand-dark">
            {e.kind === "res" ? initials(e.r.clientName) : `${e.list.length}/${GROUP_CAPACITY}`}
            {series && <span aria-hidden>↻</span>}
            {locked && <LockIcon />}
          </span>
          <span style={{ color }}>{SVC_ICON[service]}</span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1 text-brand-muted">
            {time}
            {tight && e.kind === "res" && <span style={{ color }}>{SVC_ICON[service]}</span>}
            {series && (
              <span aria-hidden title="Sèrie" className="font-bold text-brand-purple">
                ↻
              </span>
            )}
            {locked && <LockIcon />}
          </span>
          {e.kind === "res" ? (
            <span className="font-bold break-words text-brand-dark">
              {shortName(e.r.clientName)}
              {e.r.isComplimentary && (
                <span className="ml-1 rounded-full bg-brand-orange px-1 font-bold text-white" title="Cortesia">
                  C
                </span>
              )}
            </span>
          ) : (
            <span className="font-bold text-brand-dark">
              <GroupNames list={e.list} crowded={toMark || waiting > 0} />
            </span>
          )}
          {/* Amb una senyal a sota, el servei d'una sessió individual puja a la
              línia de l'hora (només la icona): així la targeta no passa de
              quatre línies i res no es talla. */}
          {!(tight && e.kind === "res") && (
            <span className="flex items-center gap-0.5" style={{ color }}>
              {SVC_ICON[service]}
              {e.kind === "group" ? `Grup ${e.list.length}/${GROUP_CAPACITY}` : SHORT[service]}
            </span>
          )}
          {toMark ? (
            <span className="rounded bg-brand-orange px-1 font-bold text-white">Per marcar</span>
          ) : waiting > 0 ? (
            <span className="font-bold text-brand-orange-dark">+{waiting} en espera</span>
          ) : null}
        </>
      )}
    </button>
  );
}

/**
 * Els noms d'un grup. A l'escriptori hi caben tots; al mòbil, dos i «+N»:
 * mai un nom tallat a mitges. La llista sencera, en tocar la targeta.
 */
function GroupNames({ list, crowded }: { list: ReservationListItem[]; crowded: boolean }) {
  const first = list.map((r) => r.clientName.split(/\s+/)[0]);
  // Quants noms hi caben en UNA línia sense tallar-ne cap. Amb una línia de
  // més a la targeta («Per marcar», «+2 en espera»), al mòbil no n'hi cap cap:
  // la targeta diu «Grup 4/4» i en tocar-la surten tots.
  const shown = (n: number) => (
    <>
      {first.slice(0, n).join(", ")}
      {first.length > n && ` +${first.length - n}`}
    </>
  );
  return (
    <>
      {!crowded && <span className="md:hidden">{shown(2)}</span>}
      <span className="hidden md:inline">{crowded ? shown(2) : first.join(", ")}</span>
    </>
  );
}

/**
 * La llista d'una hora plena (el «+N») o d'un grup. Mateixa forma que la fitxa:
 * fulla al mòbil, plafó a l'escriptori. Cada fila obre la seva fitxa.
 */
function EntryListSheet({
  title,
  entries,
  palette,
  manageable,
  onPick,
  onClose,
}: {
  title: string;
  entries: Entry[];
  palette: ColorPalette;
  manageable: Set<string>;
  onPick: (e: Entry) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-stretch md:justify-end"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:h-full md:max-h-none md:w-[26rem] md:rounded-none md:p-6"
      >
        <h2 className="text-lg font-bold text-brand-dark">{title}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {entries.map((e) => {
            const service: ServiceType =
              e.kind === "res" ? e.r.serviceType : e.kind === "group" ? "grupo_reducido" : "ep_individual";
            const color = e.kind === "trial" ? TRIAL_COLOR : colorOfService(palette, service);
            const name =
              e.kind === "res"
                ? e.r.clientName
                : e.kind === "trial"
                  ? `Prova · ${e.t.fullName}`
                  : `Grup ${e.list.length}/${GROUP_CAPACITY}`;
            const who =
              e.kind === "res" ? e.r.trainerName : e.kind === "group" ? e.list[0].trainerName : null;
            const locked = e.kind === "res" ? !manageable.has(e.r.id) : false;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-left text-sm hover:bg-brand-bg ${TAP_SURFACE}`}
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <span className="font-bold text-brand-muted">{hhmm(e.start)}</span>
                  <span className="flex-1">
                    <span className="block font-bold text-brand-dark">{name}</span>
                    <span className="block text-xs text-brand-muted">
                      {SERVICE_LABELS[service]}
                      {who ? ` · ${who}` : ""}
                    </span>
                  </span>
                  {locked && <LockIcon />}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
        >
          Tancar
        </button>
      </div>
    </div>
  );
}
