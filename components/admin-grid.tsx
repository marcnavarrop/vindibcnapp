"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TAP, clsx } from "@/lib/utils";
import { GROUP_CAPACITY, SERVICE_LABELS, SERVICE_TYPES, SESSION_DURATION_MINUTES } from "@/lib/labels";
import {
  localDateStr,
  ruleApplies,
  weekdayOf,
  type TrainerBlockLite,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import { occupancyFromSessions } from "@/lib/free-slots";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import { ReservationSheet } from "@/components/reservation-sheet";
import { TrialModal } from "@/components/agenda-pieces";
import {
  EntryListSheet,
  Grid,
  GridPlaceholder,
  NavLink,
  freeRunsOf,
  type DayInfo,
  type Entry,
} from "@/components/trainer-grid";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type { SessionNote } from "@/lib/data/session-notes";
import type { CenterBlock } from "@/lib/data/availability-blocks";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import type { AgendaNav } from "@/lib/agenda-window";
import type { ServiceType } from "@/types/database";

/*
 * L'AGENDA DE L'ADMIN: UN DIA, UNA COLUMNA PER PROFESSIONAL.
 *
 * És la rejilla del professional (`trainer-grid.tsx`) girada: allà cada
 * columna és un dia; aquí, un professional, el mateix dia. La geometria, les
 * targetes, la densitat, els forats reals i la fitxa són les mateixes peces.
 *
 *   · Al mòbil, tres columnes alhora (com els tres dies del professional). Si
 *     n'hi ha més d'encesos, les fletxes ‹ › mouen la finestra d'un en un.
 *   · A l'ordinador, tots els encesos.
 *   · Els professionals encesos i el servei es recorden en aquest navegador.
 *   · Tocar un forat obre «Nova reserva» amb el professional i l'hora posats.
 *
 * Només al navegador, com la del professional: l'hora de cada sessió és la del
 * navegador, i pintar-la al servidor (en UTC) donava l'error #418.
 */

type ReservationAction = (formData: FormData) => void | Promise<void>;
type StatefulReservationAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;

/** Quants professionals caben alhora al mòbil. */
const MOBILE_COLUMNS = 3;
/** On es recorden els professionals apagats i el servei triat. */
const HIDDEN_KEY = "vindi.admin.agenda.amagats";
const SERVICE_KEY = "vindi.admin.agenda.servei";
/** Les reserves sense professional, si n'hi ha, van en una columna seva. */
const NONE = "sense-professional";

const longDayFmt = new Intl.DateTimeFormat("ca-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortDayFmt = new Intl.DateTimeFormat("ca-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function slotFloat(d: Date): number {
  return (d.getHours() * 60 + d.getMinutes()) / 30;
}
/** El format del camp de data i hora del formulari de «Nova reserva». */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Per buscar noms sense que importin els accents ni les majúscules. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AdminGrid({
  nav,
  reservations,
  trials,
  trainers,
  rules,
  blocks,
  centerBlocks,
  palette,
  notes,
  clientBase,
  newReservationBase,
  cancelAction,
  completeAction,
  rescheduleAction,
  acceptTrialAction,
  rejectTrialAction,
  openingHour,
  closingHour,
}: {
  nav: AgendaNav;
  /** Totes les de la finestra: les que es pinten i les que ocupen. */
  reservations: ReservationListItem[];
  trials: TrialHoldItem[];
  trainers: { id: string; name: string }[];
  /** Les regles de tots els professionals. */
  rules: TrainerRuleLite[];
  /** Els bloquejos de tots, sense motiu: per calcular els forats. */
  blocks: TrainerBlockLite[];
  /** Els bloquejos de tots, amb el motiu: per pintar-los (només l'admin). */
  centerBlocks: CenterBlock[];
  palette: ColorPalette;
  notes?: Record<string, SessionNote>;
  clientBase: string;
  newReservationBase: string;
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
  rescheduleAction: StatefulReservationAction;
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
  openingHour: number;
  closingHour: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReservationListItem | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<TrialHoldItem | null>(null);
  const [list, setList] = useState<{ title: string; entries: Entry[] } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Només al navegador (vegeu la capçalera).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /*
   * Es recorden els APAGATS, no els encesos: un professional nou surt encès
   * sense que ningú hagi de tocar res. Qualsevol error del navegador (mode
   * privat, emmagatzematge blocat) vol dir «tots encesos, tots els serveis».
   */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [service, setService] = useState<ServiceType | "">("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_KEY);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(ids)) setHidden(new Set(ids.filter((x): x is string => typeof x === "string")));
      const svc = window.localStorage.getItem(SERVICE_KEY);
      if (svc && (SERVICE_TYPES as string[]).includes(svc)) setService(svc as ServiceType);
    } catch {
      // Sense memòria: tots encesos.
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
      if (service) window.localStorage.setItem(SERVICE_KEY, service);
      else window.localStorage.removeItem(SERVICE_KEY);
    } catch {
      // Sense memòria: funciona igual, però no es recordarà.
    }
  }, [hidden, service, loaded]);

  const date = parseDay(nav.dayStart);
  const dayKey = nav.dayStart;
  const manageable = useMemo(() => new Set(reservations.map((r) => r.id)), [reservations]);

  // Ocupació per als forats lliures: reserves vives i proves actives.
  const occupancy = useMemo(
    () =>
      occupancyFromSessions([
        ...reservations
          .filter((r) => r.status === "booked")
          .map((r) => ({ trainerId: r.trainerId, scheduledAt: r.scheduledAt, serviceType: r.serviceType })),
        ...trials.map((t) => ({ trainerId: t.trainerId, scheduledAt: t.scheduledAt, serviceType: t.serviceType })),
      ]),
    [reservations, trials],
  );

  // Les entrades del dia, per professional. Un grup és una sola entrada.
  const byPro = useMemo(() => {
    const m = new Map<string, Entry[]>();
    const push = (k: string, e: Entry) => (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    const end = (s: Date) => new Date(s.getTime() + SESSION_DURATION_MINUTES * 60_000);
    const groups = new Map<string, ReservationListItem[]>();
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const s = new Date(r.scheduledAt);
      if (localDateStr(s) !== dayKey) continue;
      if (r.serviceType === "grupo_reducido") {
        const k = `${r.trainerId ?? NONE}|${r.scheduledAt}`;
        (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
        continue;
      }
      push(r.trainerId ?? NONE, { kind: "res", id: r.id, start: s, end: end(s), own: true, r });
    }
    for (const [k, g] of groups) {
      const s = new Date(g[0].scheduledAt);
      push(g[0].trainerId ?? NONE, {
        kind: "group",
        id: `g:${k}`,
        start: s,
        end: end(s),
        own: true,
        list: [...g].sort((a, b) => a.clientName.localeCompare(b.clientName)),
      });
    }
    for (const t of trials) {
      const s = new Date(t.scheduledAt);
      if (localDateStr(s) !== dayKey) continue;
      push(t.trainerId ?? NONE, { kind: "trial", id: `t:${t.id}`, start: s, end: end(s), own: true, t });
    }
    return m;
  }, [reservations, trials, dayKey]);

  // Filtres: servei i client. Els forats només es filtren pel servei.
  const q = norm(query.trim());
  const keep = (e: Entry): boolean => {
    const svc: ServiceType =
      e.kind === "res" ? e.r.serviceType : e.kind === "group" ? "grupo_reducido" : e.t.serviceType;
    if (service && svc !== service) return false;
    if (!q) return true;
    const names =
      e.kind === "res" ? [e.r.clientName] : e.kind === "group" ? e.list.map((r) => r.clientName) : [e.t.fullName];
    return names.some((n) => norm(n).includes(q));
  };

  // Les columnes: els professionals encesos (i «sense professional» si cal).
  const pros = [
    ...trainers,
    ...((byPro.get(NONE)?.length ?? 0) > 0 ? [{ id: NONE, name: "Sense professional" }] : []),
  ];
  const visible = pros.filter((p) => !hidden.has(p.id));
  const wd = weekdayOf(date);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);

  const column = (p: { id: string; name: string }): DayInfo => {
    const entries = (byPro.get(p.id) ?? []).filter(keep);
    const proRules = rules.filter((r) => r.trainerId === p.id && ruleApplies(r, dayKey, wd));
    const free = freeRunsOf({ trainerId: p.id, rules, blocks, occupancy, date, key: dayKey, wd, now }).filter(
      (f) => !service || f.services.includes(service),
    );
    const dayBlocks = centerBlocks
      .filter((b) => b.trainerId === p.id)
      .map((b) => ({ s: new Date(b.startAt), e: new Date(b.endAt), reason: b.reason }))
      .filter((b) => b.s < dayEnd && b.e > dayStart)
      .map((b) => ({
        from: b.s <= dayStart ? 0 : slotFloat(b.s),
        to: b.e >= dayEnd ? 48 : slotFloat(b.e),
        reason: b.reason,
      }));
    const sessions = entries.filter((e) => e.kind !== "trial").length;
    const color = p.id === NONE ? "#9a9a9e" : colorOfPro(palette, p.id);
    const first = p.name.split(/\s+/)[0];
    return {
      date,
      key: p.id,
      dateKey: dayKey,
      head: (
        <>
          <div className="flex items-center justify-center gap-1 text-sm font-bold text-brand-dark">
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
            <span className="truncate md:hidden">{first}</span>
            <span className="hidden truncate md:inline">{p.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-brand-muted">
            {sessions === 0 ? (proRules.length ? "—" : "sense horari") : `${sessions} ${sessions === 1 ? "sessió" : "ses."}`}
          </div>
        </>
      ),
      entries,
      rail: [],
      rules: proRules,
      free,
      blocks: dayBlocks,
      waiting: new Map(),
    };
  };

  // Mòbil: tres alhora, amb una finestra que es mou.
  const maxStart = Math.max(0, visible.length - MOBILE_COLUMNS);
  const from = Math.min(start, maxStart);
  const mobileCols = visible.slice(from, from + MOBILE_COLUMNS).map(column);
  const desktopCols = visible.map(column);

  const open = (e: Entry) => {
    if (e.kind === "res") setSelected(e.r);
    else if (e.kind === "trial") setSelectedTrial(e.t);
    else
      setList({
        title: `Grup · ${hhmm(e.start)} · ${e.list.length}/${GROUP_CAPACITY}${
          e.list[0].trainerName ? ` · ${e.list[0].trainerName}` : ""
        }`,
        entries: e.list.map((r) => ({ kind: "res" as const, id: r.id, start: e.start, end: e.end, own: true, r })),
      });
  };

  const gridProps = {
    now,
    showAll,
    openingHour,
    closingHour,
    palette,
    manageable,
    todayKey: now ? localDateStr(now) : "",
    onOpen: open,
    onMore: (title: string, entries: Entry[]) => setList({ title, entries }),
    // El forat diu el professional (la columna) i l'hora. Fins que l'admin
    // tingui la fulla de crear, obre el formulari amb tots dos posats.
    onNew: (at: Date, _services: ServiceType[], col: string) => {
      const params = new URLSearchParams({ at: toLocalInput(at) });
      if (col !== NONE) params.set("trainer", col);
      router.push(`${newReservationBase}?${params}`);
    },
    colleagues: [],
    onRail: () => {},
  };

  const dayHref = (d: Date) => `${nav.basePath}?dia=${localDateStr(d)}`;
  const isToday = dayKey === nav.today;
  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dayNav = (
    <div className="flex min-w-0 items-center gap-2">
      <NavLink label="Dia anterior" href={dayHref(addDays(date, -1))}>‹</NavLink>
      <Link
        href={nav.basePath}
        aria-current={isToday ? "page" : undefined}
        className={`flex h-11 items-center rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-charcoal hover:bg-brand-bg md:h-9 ${TAP}`}
      >
        Avui
      </Link>
      <NavLink label="Dia següent" href={dayHref(addDays(date, 1))}>›</NavLink>
      <span className="ml-1 truncate text-sm font-bold text-brand-dark first-letter:uppercase" data-day-label>
        <span className="md:hidden">{shortDayFmt.format(date)}</span>
        <span className="hidden md:inline">{longDayFmt.format(date)}</span>
      </span>
    </div>
  );
  const showAllButton = (
    <button
      type="button"
      onClick={() => setShowAll((v) => !v)}
      aria-pressed={showAll}
      data-show-all
      className={clsx(
        "min-h-11 rounded-lg border px-3 text-sm font-bold md:min-h-9",
        showAll
          ? "border-brand-purple bg-brand-purple text-white"
          : "border-brand-border bg-white text-brand-charcoal hover:bg-brand-bg",
        TAP,
      )}
    >
      {showAll ? "Només el que hi ha" : "Mostrar-ho tot"}
    </button>
  );
  // Al mòbil els filtres van plegats darrere d'un botó que en fa el resum:
  // l'agenda ha de començar tan amunt com es pugui.
  const filtering = hidden.size > 0 || !!service || !!q;
  const filterSummary = `${visible.length}/${pros.length}${service ? ` · ${SERVICE_LABELS[service]}` : ""}${q ? " · client" : ""}`;

  return (
    <div>
      {/* ── El dia ────────────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center justify-between gap-2 md:mb-3 md:gap-3">
        {dayNav}
        <div className="hidden md:block">{showAllButton}</div>
      </div>

      {/* ── Mòbil: el botó dels filtres i la finestra de tres ─────────────── */}
      <div className="mb-2 flex items-center gap-2 md:hidden">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="agenda-filtres"
          onClick={() => setFiltersOpen((v) => !v)}
          data-filters-toggle
          className={clsx(
            "flex min-h-11 min-w-0 items-center gap-1 rounded-lg border px-3 text-sm font-bold",
            filtering ? "border-brand-purple text-brand-purple" : "border-brand-border text-brand-charcoal",
            "bg-white",
            TAP,
          )}
        >
          <span className="truncate">Filtres · {filterSummary}</span>
          <span aria-hidden>{filtersOpen ? "▴" : "▾"}</span>
        </button>
        {visible.length > MOBILE_COLUMNS && (
          <div className="ml-auto flex shrink-0 items-center gap-1 text-sm" data-window>
            <button
              type="button"
              aria-label="Professionals anteriors"
              disabled={from === 0}
              onClick={() => setStart(Math.max(0, from - 1))}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold disabled:opacity-40 ${TAP}`}
            >
              ‹
            </button>
            <span className="px-1 whitespace-nowrap text-brand-muted">
              {from + 1}–{Math.min(from + MOBILE_COLUMNS, visible.length)} de {visible.length}
            </span>
            <button
              type="button"
              aria-label="Professionals següents"
              disabled={from >= maxStart}
              onClick={() => setStart(Math.min(maxStart, from + 1))}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold disabled:opacity-40 ${TAP}`}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* ── Filtres: qui es veu, quin servei i quin client ─────────────────── */}
      <div
        id="agenda-filtres"
        className={clsx("mb-3 flex-col gap-2 md:mb-4 md:flex", filtersOpen ? "flex" : "hidden")}
        data-filters
      >
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" data-pros>
          {pros.map((p) => {
            const on = !hidden.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                data-pro={p.id}
                onClick={() => toggle(p.id)}
                className={clsx(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold whitespace-nowrap md:min-h-9",
                  on ? "border-brand-border bg-white text-brand-dark" : "border-brand-border bg-brand-bg text-brand-muted",
                  TAP,
                )}
              >
                <span
                  aria-hidden
                  className={clsx("inline-block h-2.5 w-2.5 rounded-sm", !on && "opacity-30")}
                  style={{ backgroundColor: p.id === NONE ? "#9a9a9e" : colorOfPro(palette, p.id) }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Servei"
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType | "")}
            className="min-h-11 rounded-lg border border-brand-border bg-white px-2 text-sm text-brand-charcoal md:min-h-9"
          >
            <option value="">Tots els serveis</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Busca un client"
            placeholder="Busca un client…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 min-w-40 flex-1 rounded-lg border border-brand-border bg-white px-3 text-sm md:min-h-9 md:max-w-xs md:flex-none"
          />
          <div className="md:hidden">{showAllButton}</div>
        </div>
      </div>

      {/* ── Mòbil: tres professionals alhora ──────────────────────────────── */}
      <div className="md:hidden" data-grid="mobile">
        {!now ? (
          <GridPlaceholder />
        ) : mobileCols.length ? (
          <Grid {...gridProps} columns={mobileCols} />
        ) : (
          <NoneVisible />
        )}
      </div>

      {/* ── Escriptori: tots els encesos ──────────────────────────────────── */}
      <div className="hidden md:block" data-grid="desktop">
        {!now ? (
          <GridPlaceholder />
        ) : desktopCols.length ? (
          <Grid {...gridProps} columns={desktopCols} />
        ) : (
          <NoneVisible />
        )}
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Toca un forat lliure per crear-hi una reserva amb aquell professional i aquella hora, o una sessió per obrir-ne la fitxa.
      </p>

      {selected && (
        <ReservationSheet
          r={selected}
          palette={palette}
          canManage
          canCancel
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          note={notes?.[selected.id] ?? null}
          // L'administració llegeix les notes i no n'escriu cap (0079).
          canWriteNote={false}
          clientHref={`${clientBase}/${selected.clientId}`}
          reschedulePicker
          onClose={() => setSelected(null)}
        />
      )}
      {selectedTrial && (
        <TrialModal
          t={selectedTrial}
          canManage
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

function NoneVisible() {
  return (
    <p className="rounded-xl border border-brand-border bg-white p-6 text-center text-sm text-brand-muted">
      No hi ha cap professional encès. Toca un nom de dalt per veure&apos;n l&apos;agenda.
    </p>
  );
}
