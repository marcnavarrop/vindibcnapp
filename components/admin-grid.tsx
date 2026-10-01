"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { agendaLoad } from "@/lib/agenda-load";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import { ReservationSheet } from "@/components/reservation-sheet";
import { TrialModal } from "@/components/agenda-pieces";
import { CreateSlotSheet } from "@/components/create-slot-sheet";
import { searchClientsAction } from "@/app/actions/client-search-actions";
import {
  EntryListSheet,
  Grid,
  GridPlaceholder,
  NavLink,
  FREE_COLOR,
  freeRunsOf,
  isToMarkAge,
  type DayInfo,
  type Entry,
} from "@/components/trainer-grid";
import { AdminWeek, type WeekDay, type WeekLane } from "@/components/admin-week";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type { SessionNote } from "@/lib/data/session-notes";
import type { CenterBlock } from "@/lib/data/availability-blocks";
import type { WaitingNames } from "@/lib/data/waitlist";
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
 *   · Tocar un forat obre la fulla de crear amb el professional de la columna
 *     i l'hora; el client es busca al servidor entre tots els del centre.
 *   · Un grup amb places ofereix «Apuntar-hi un client» (qualsevol), i diu qui
 *     espera plaça, amb el nom i per ordre.
 *   · A dalt, la tira de la setmana (dl–dv): l'ocupació de cada professional,
 *     els grups plens i qui espera, i un toc per anar a aquell dia.
 *   · Cada columna diu el «Pròxim forat» del professional en les dues setmanes
 *     vinents; tocant-lo, s'hi va i s'obre la fulla de crear.
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
/** Fins on busca «Pròxim forat»: avui i els tretze dies següents. */
const NEXT_FREE_DAYS = 14;
const stripDayFmt = new Intl.DateTimeFormat("ca-ES", { weekday: "short", day: "numeric" });
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
  waiting,
  palette,
  notes,
  clientBase,
  createFromSlotAction,
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
  /** Qui espera plaça a cada sessió, amb el nom (només l'admin). */
  waiting: WaitingNames[];
  palette: ColorPalette;
  notes?: Record<string, SessionNote>;
  clientBase: string;
  createFromSlotAction: StatefulReservationAction;
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
  rescheduleAction: StatefulReservationAction;
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
  openingHour: number;
  closingHour: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<ReservationListItem | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<TrialHoldItem | null>(null);
  const [list, setList] = useState<{
    title: string;
    entries: Entry[];
    join?: { at: Date; count: number; trainer: { id: string; name: string } };
    waitlist?: string[];
  } | null>(null);
  const [creating, setCreating] = useState<{
    at: Date;
    services: ServiceType[];
    trainer: { id: string; name: string };
    group?: { count: number };
  } | null>(null);
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
  // Qui espera, per professional i hora.
  const waitingOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const w of waiting) m.set(`${w.trainerId}|${new Date(w.at).getTime()}`, w.names);
    return m;
  }, [waiting]);

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

  const trainerOf = (id: string | null) => trainers.find((t) => t.id === id) ?? null;
  // «Pròxim forat»: el primer inici lliure de cada professional d'avui a
  // tretze dies, amb el filtre de servei si n'hi ha. Surt dels mateixos forats
  // reals que pinta la rejilla (`freeRunsOf`), i per això el servidor carrega
  // les reserves d'aquestes dues setmanes (vegeu la pàgina).
  const nextFree = useMemo(() => {
    const m = new Map<string, { at: Date; services: ServiceType[] } | null>();
    if (!now) return m;
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    for (const t of trainers) {
      let found: { at: Date; services: ServiceType[] } | null = null;
      for (let i = 0; i < NEXT_FREE_DAYS && !found; i++) {
        const d = addDays(base, i);
        const run = freeRunsOf({
          trainerId: t.id,
          rules,
          blocks,
          occupancy,
          date: d,
          key: localDateStr(d),
          wd: weekdayOf(d),
          now,
        }).find((f) => !service || f.services.includes(service));
        if (run) {
          const at = new Date(d);
          at.setHours(0, run.from * 30, 0, 0);
          found = { at, services: service ? [service] : run.services };
        }
      }
      m.set(t.id, found);
    }
    return m;
  }, [now, trainers, rules, blocks, occupancy, service]);

  // Tocar «Pròxim forat»: si és el dia que es veu, la fulla de crear; si no,
  // s'hi va, i la fulla s'obre en arribar (`?forat=…&pro=…`).
  const goNextFree = (proId: string) => {
    const nf = nextFree.get(proId);
    const pro = trainerOf(proId);
    if (!nf || !pro) return;
    if (localDateStr(nf.at) === dayKey) setCreating({ at: nf.at, services: nf.services, trainer: pro });
    else
      router.push(
        `${nav.basePath}?dia=${localDateStr(nf.at)}&forat=${encodeURIComponent(nf.at.toISOString())}&pro=${encodeURIComponent(proId)}`,
      );
  };
  const wantAt = params.get("forat");
  const wantPro = params.get("pro");
  useEffect(() => {
    if (!now || !wantAt || !wantPro) return;
    const at = new Date(wantAt);
    const pro = trainers.find((t) => t.id === wantPro);
    // Es neteja l'adreça: recarregar no ha de tornar a obrir la fulla.
    router.replace(`${nav.basePath}?dia=${dayKey}`, { scroll: false });
    if (!pro || Number.isNaN(at.getTime())) return;
    const services =
      freeRunsOf({ trainerId: pro.id, rules, blocks, occupancy, date: parseDay(dayKey), key: dayKey, wd: weekdayOf(parseDay(dayKey)), now })
        .find((f) => f.from <= slotFloat(at) && slotFloat(at) <= f.lastStart)?.services ?? [];
    if (services.length) setCreating({ at, services: service && services.includes(service) ? [service] : services, trainer: pro });
    // Només en arribar amb els paràmetres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now === null, wantAt, wantPro]);

  /*
   * LA TIRA DE LA SETMANA (dl–dv). Per a cada dia i cada professional encès,
   * la seva ocupació (`agendaLoad`: la mateixa xifra que l'Inici i el mode
   * «Setmana»). I del dia sencer, quants grups són plens i quanta gent espera.
   */
  const weekStart = parseDay(nav.weekStart);
  const strip = useMemo(() => {
    if (!now) return [];
    const shown = visible.filter((p) => p.id !== NONE);
    return Array.from({ length: 5 }, (_, i) => {
      const d = addDays(weekStart, i);
      const key = localDateStr(d);
      // L'ocupació és la de l'Inici (`lib/occupancy.ts`), en hora del navegador.
      const pros = shown.map((p) => ({
        id: p.id,
        name: p.name,
        pct: agendaLoad({ trainerId: p.id, rules, blocks, reservations, days: [key] }),
      }));
      const groups = new Map<string, number>();
      for (const r of reservations)
        if (
          r.status !== "cancelled" &&
          r.serviceType === "grupo_reducido" &&
          r.trainerId &&
          shown.some((p) => p.id === r.trainerId) &&
          localDateStr(new Date(r.scheduledAt)) === key
        )
          groups.set(`${r.trainerId}|${r.scheduledAt}`, (groups.get(`${r.trainerId}|${r.scheduledAt}`) ?? 0) + 1);
      const full = [...groups.values()].filter((n) => n >= GROUP_CAPACITY).length;
      const waitingN = waiting
        .filter((x) => shown.some((p) => p.id === x.trainerId) && localDateStr(new Date(x.at)) === key)
        .reduce((n, x) => n + x.names.length, 0);
      return { date: d, key, pros, full, waiting: waitingN };
    });
    // `weekStart` es deriva de `nav.weekStart`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now === null, nav.weekStart, visible.map((p) => p.id).join(), rules, blocks, occupancy, reservations, waiting]);

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
          <div
            className={clsx(
              "flex items-center justify-center gap-1 rounded text-sm font-bold text-brand-dark",
              focusPro === p.id && "bg-brand-purple/10 ring-2 ring-brand-purple",
            )}
            data-focused={focusPro === p.id || undefined}
          >
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
            <span className="truncate md:hidden">{first}</span>
            <span className="hidden truncate md:inline">{p.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-brand-muted">
            {sessions === 0 ? (proRules.length ? "—" : "sense horari") : `${sessions} ${sessions === 1 ? "sessió" : "ses."}`}
          </div>
          {p.id !== NONE && <NextFreeButton next={nextFree.get(p.id) ?? null} today={nav.today} onGo={() => goNextFree(p.id)} />}
        </>
      ),
      entries,
      rail: [],
      rules: proRules,
      free,
      blocks: dayBlocks,
      waiting: new Map(
        waiting
          .filter((w) => w.trainerId === p.id)
          .map((w) => [new Date(w.at).getTime(), w.names.length] as const),
      ),
    };
  };

  /*
   * EL MODE «SETMANA» (només a l'ordinador; vegeu `admin-week.tsx`). Les
   * mateixes peces que el dia: les entrades agrupades igual, els forats de
   * `freeRunsOf`, els bloquejos amb el motiu i l'ocupació de `agendaLoad`.
   */
  const isWeek = nav.view === "week";
  const weekDays = useMemo<WeekDay[]>(() => {
    if (!isWeek || !now) return [];
    const end = (s: Date) => new Date(s.getTime() + SESSION_DURATION_MINUTES * 60_000);
    // Les entrades de la setmana, per dia i professional. Un grup, una entrada.
    const byKey = new Map<string, Entry[]>();
    const push = (k: string, e: Entry) => (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e);
    const groups = new Map<string, ReservationListItem[]>();
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const s = new Date(r.scheduledAt);
      const k = `${localDateStr(s)}|${r.trainerId ?? NONE}`;
      if (r.serviceType === "grupo_reducido") {
        const g = `${k}|${r.scheduledAt}`;
        (groups.get(g) ?? groups.set(g, []).get(g)!).push(r);
      } else push(k, { kind: "res", id: r.id, start: s, end: end(s), own: true, r });
    }
    for (const [g, list] of groups) {
      const s = new Date(list[0].scheduledAt);
      push(g.split("|").slice(0, 2).join("|"), {
        kind: "group",
        id: `g:${g}`,
        start: s,
        end: end(s),
        own: true,
        list: [...list].sort((a, b) => a.clientName.localeCompare(b.clientName)),
      });
    }
    for (const t of trials) {
      const s = new Date(t.scheduledAt);
      push(`${localDateStr(s)}|${t.trainerId ?? NONE}`, { kind: "trial", id: `t:${t.id}`, start: s, end: end(s), own: true, t });
    }
    const svcOf = (e: Entry): ServiceType =>
      e.kind === "res" ? e.r.serviceType : e.kind === "group" ? "grupo_reducido" : e.t.serviceType;

    const shown = trainers.filter((p) => !hidden.has(p.id));
    const out: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const key = localDateStr(date);
      const wd = weekdayOf(date);
      // El cap de setmana només hi surt si algú hi té horari o alguna cosa.
      if (
        i >= 5 &&
        !rules.some((r) => shown.some((p) => p.id === r.trainerId) && ruleApplies(r, key, wd)) &&
        ![...shown, { id: NONE }].some((p) => byKey.has(`${key}|${p.id}`))
      )
        continue;
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = addDays(dayStart, 1);
      const lanes: WeekLane[] = [];
      const off: string[] = [];
      const lanePros = [
        ...shown,
        ...(!hidden.has(NONE) && byKey.has(`${key}|${NONE}`) ? [{ id: NONE, name: "Sense professional" }] : []),
      ];
      for (const p of lanePros) {
        const entries = (byKey.get(`${key}|${p.id}`) ?? []).filter((e) => !service || svcOf(e) === service);
        const schedule = rules
          .filter((r) => r.trainerId === p.id && ruleApplies(r, key, wd))
          .map((r) => [r.startSlot, r.endSlot] as [number, number]);
        const laneBlocks = centerBlocks
          .filter((b) => b.trainerId === p.id)
          .map((b) => ({ s: new Date(b.startAt), e: new Date(b.endAt), reason: b.reason }))
          .filter((b) => b.s < dayEnd && b.e > dayStart)
          .map((b) => ({
            from: b.s <= dayStart ? 0 : slotFloat(b.s),
            to: b.e >= dayEnd ? 48 : slotFloat(b.e),
            reason: b.reason,
          }));
        if (!schedule.length && !entries.length && !laneBlocks.length) {
          off.push(p.name.split(/\s+/)[0]);
          continue;
        }
        const free =
          p.id === NONE
            ? []
            : freeRunsOf({ trainerId: p.id, rules, blocks, occupancy, date, key, wd, now }).filter(
                (f) => !service || f.services.includes(service),
              );
        const toMark = new Set(
          entries
            .filter(
              (e) =>
                e.end.getTime() <= now.getTime() &&
                isToMarkAge(e.start, now) &&
                (e.kind === "res"
                  ? e.r.status === "booked"
                  : e.kind === "group" && e.list.some((r) => r.status === "booked")),
            )
            .map((e) => e.id),
        );
        lanes.push({
          pro: { id: p.id, name: p.name.split(/\s+/)[0], color: p.id === NONE ? "#9a9a9e" : colorOfPro(palette, p.id) },
          load: p.id === NONE ? null : agendaLoad({ trainerId: p.id, rules, blocks, reservations, days: [key] }),
          schedule,
          entries,
          free,
          blocks: laneBlocks,
          toMark,
          waiting: new Map(
            waiting
              .filter((w) => w.trainerId === p.id)
              .map((w) => [new Date(w.at).getTime(), w.names.length] as const),
          ),
        });
      }
      const all = lanes.flatMap((l) => l.entries);
      const freeSlots = new Set<string>();
      for (const l of lanes) for (const f of l.free) for (let x = f.from; x < f.to; x++) freeSlots.add(`${l.pro.id}|${x}`);
      out.push({
        key,
        date,
        isToday: key === nav.today,
        lanes,
        off,
        summary: {
          sessions: all.filter((e) => e.kind !== "trial").length,
          full: all.filter((e) => e.kind === "group" && e.list.length >= GROUP_CAPACITY).length,
          waiting: waiting
            .filter((w) => lanes.some((l) => l.pro.id === w.trainerId) && localDateStr(new Date(w.at)) === key)
            .reduce((n, w) => n + w.names.length, 0),
          toMark: lanes.reduce((n, l) => n + l.toMark.size, 0),
          freeHours: freeSlots.size / 2,
        },
      });
    }
    return out;
    // `weekStart` es deriva de `nav.weekStart`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeek, now === null, nav.weekStart, nav.today, trainers, hidden, service, reservations, trials, rules, blocks, centerBlocks, occupancy, waiting, palette]);
  const shownCount = trainers.filter((p) => !hidden.has(p.id)).length;
  // Els totals de la setmana de cada professional, als botons del filtre: les
  // sessions (un grup, una) i l'ocupació de la setmana (`agendaLoad`, la de
  // l'Inici). Només a la setmana.
  const weekTotals = useMemo(() => {
    const m = new Map<string, { sessions: number; load: number | null }>();
    if (!isWeek || !now) return m;
    const keys = Array.from({ length: 7 }, (_, i) => localDateStr(addDays(weekStart, i)));
    const keySet = new Set(keys);
    for (const p of trainers) {
      const groupsSeen = new Set<string>();
      let sessions = 0;
      for (const r of reservations) {
        if (r.trainerId !== p.id || r.status === "cancelled") continue;
        if (!keySet.has(localDateStr(new Date(r.scheduledAt)))) continue;
        if (r.serviceType === "grupo_reducido") {
          if (groupsSeen.has(r.scheduledAt)) continue;
          groupsSeen.add(r.scheduledAt);
        }
        sessions++;
      }
      m.set(p.id, { sessions, load: agendaLoad({ trainerId: p.id, rules, blocks, reservations, days: keys }) });
    }
    return m;
    // `weekStart` es deriva de `nav.weekStart`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeek, now === null, nav.weekStart, trainers, reservations, rules, blocks]);
  const laneHeight = shownCount <= 4 ? 28 : shownCount <= 6 ? 26 : 24;
  const weekLabel = (() => {
    const fmt = new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "short" });
    const last = weekDays.length ? weekDays[weekDays.length - 1].date : addDays(weekStart, 4);
    return `${fmt.format(weekStart)} – ${fmt.format(last)}`;
  })();

  // Mòbil: tres alhora, amb una finestra que es mou.
  /*
   * `?pro=…` sense `forat` (els enllaços de l'inici): la columna d'aquell
   * professional ha de sortir, encara que estigués apagat, i al mòbil la
   * finestra de tres s'hi posa. La capçalera queda marcada.
   */
  const focusPro = !wantAt && wantPro && pros.some((p) => p.id === wantPro) ? wantPro : null;
  useEffect(() => {
    if (!loaded || !focusPro) return;
    if (hidden.has(focusPro))
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(focusPro);
        return next;
      });
    const shown = pros.filter((p) => p.id === focusPro || !hidden.has(p.id));
    const i = shown.findIndex((p) => p.id === focusPro);
    setStart(Math.max(0, Math.min(i, shown.length - MOBILE_COLUMNS)));
    // Només en arribar amb l'enllaç (i un cop llegida la memòria del navegador).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, focusPro]);

  const maxStart = Math.max(0, visible.length - MOBILE_COLUMNS);
  const from = Math.min(start, maxStart);
  const mobileCols = visible.slice(from, from + MOBILE_COLUMNS).map(column);
  const desktopCols = visible.map(column);

  const open = (e: Entry) => {
    if (e.kind === "res") setSelected(e.r);
    else if (e.kind === "trial") setSelectedTrial(e.t);
    else {
      const pro = trainerOf(e.list[0].trainerId);
      const queue = pro ? (waitingOf.get(`${pro.id}|${e.start.getTime()}`) ?? []) : [];
      setList({
        title: `Grup · ${hhmm(e.start)} · ${e.list.length}/${GROUP_CAPACITY}${
          e.list[0].trainerName ? ` · ${e.list[0].trainerName}` : ""
        }${queue.length ? ` · +${queue.length} en espera` : ""}`,
        entries: e.list.map((r) => ({ kind: "res" as const, id: r.id, start: e.start, end: e.end, own: true, r })),
        join:
          pro && e.list.length < GROUP_CAPACITY && now && e.start.getTime() > now.getTime()
            ? { at: e.start, count: e.list.length, trainer: pro }
            : undefined,
        waitlist: queue,
      });
    }
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
    // El forat diu el professional (la columna) i l'hora: la fulla de crear
    // només ha de demanar el servei i el client.
    onNew: (at: Date, services: ServiceType[], col: string) => {
      const pro = trainerOf(col);
      if (pro) setCreating({ at, services, trainer: pro });
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

  // En mode «Setmana», tot el que és del dia només es veu per sota de lg (el
  // mòbil i la tauleta): a l'ordinador hi ha la setmana.
  const dayOnly = isWeek ? "lg:hidden" : undefined;

  return (
    <div>
      {/* ── La setmana: navegació (només a l'ordinador) ───────────────────── */}
      {isWeek && (
        <div className="mb-3 hidden items-center gap-2 lg:flex" data-week-nav>
          <NavLink label="Setmana anterior" href={nav.href.prevWeek}>‹</NavLink>
          <Link
            href={nav.href.today}
            aria-current={nav.isCurrentWeek ? "page" : undefined}
            className={`flex h-9 items-center rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-charcoal hover:bg-brand-bg ${TAP}`}
          >
            Aquesta setmana
          </Link>
          <NavLink label="Setmana següent" href={nav.href.nextWeek}>›</NavLink>
          <span className="ml-1 text-sm font-bold text-brand-dark" data-week-label>
            {weekLabel}
          </span>
        </div>
      )}

      <div className={dayOnly}>
      {/* ── El dia ────────────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center justify-between gap-2 md:mb-3 md:gap-3">
        {dayNav}
        <div className="hidden md:block">{showAllButton}</div>
      </div>

      {/* ── La tira de la setmana ─────────────────────────────────────────── */}
      {strip.length > 0 && (
        <nav aria-label="Setmana" className="mb-2 grid grid-cols-5 gap-1 md:mb-3 md:gap-2" data-week-strip>
          {strip.map((d) => {
            const summary = [
              d.full ? `${d.full} ${d.full === 1 ? "ple" : "plens"}` : "",
              d.waiting ? `${d.waiting} en espera` : "",
            ].filter(Boolean);
            const label = `${longDayFmt.format(d.date)}. ${d.pros
              .map((p) => `${p.name}: ${p.pct === null ? "sense horari" : `${Math.round(p.pct * 100)} % ocupat`}`)
              .join(", ")}${summary.length ? `. ${summary.join(", ")}` : ""}`;
            return (
              <Link
                key={d.key}
                href={`${nav.basePath}?dia=${d.key}`}
                aria-current={d.key === dayKey ? "date" : undefined}
                aria-label={label}
                data-strip-day={d.key}
                className={clsx(
                  "flex min-h-11 min-w-0 flex-col gap-0.5 rounded-lg border bg-white px-1.5 py-1 hover:bg-brand-bg md:gap-1 md:py-1.5",
                  d.key === dayKey ? "border-brand-purple ring-1 ring-brand-purple" : "border-brand-border",
                  TAP,
                )}
              >
                <span
                  className={clsx(
                    "text-xs font-bold first-letter:uppercase",
                    d.key === nav.today ? "text-brand-purple" : "text-brand-dark",
                  )}
                >
                  {stripDayFmt.format(d.date)}
                </span>
                <span className="flex flex-col gap-0.5" aria-hidden>
                  {d.pros.map((p) => (
                    <span key={p.id} className="block h-1 overflow-hidden rounded-full bg-brand-bg" data-strip-bar={p.id}>
                      {p.pct !== null && (
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.round(p.pct * 100)}%`, backgroundColor: colorOfPro(palette, p.id) }}
                        />
                      )}
                    </span>
                  ))}
                </span>
                <span className="min-w-0 truncate text-[10px] leading-tight text-brand-muted md:text-xs" data-strip-summary>
                  {summary.length ? (
                    <>
                      {/* Al mòbil la casella és estreta: la llarga, a l'ordinador. */}
                      <span className="flex flex-col md:hidden">
                        {d.full > 0 && <span>{`${d.full} ${d.full === 1 ? "ple" : "plens"}`}</span>}
                        {d.waiting > 0 && <span>{`+${d.waiting} esp.`}</span>}
                      </span>
                      <span className="hidden md:inline">{summary.join(" · ")}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

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
                {isWeek && weekTotals.has(p.id) && (
                  <span className="hidden text-xs font-medium text-brand-muted lg:inline" data-pro-week>
                    {(() => {
                      const t = weekTotals.get(p.id)!;
                      return `· ${t.sessions} ses.${t.load === null ? "" : ` · ${Math.round(t.load * 100)} %`}`;
                    })()}
                  </span>
                )}
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
            className={clsx(
              "min-h-11 min-w-40 flex-1 rounded-lg border border-brand-border bg-white px-3 text-sm md:min-h-9 md:max-w-xs md:flex-none",
              // A la setmana no hi ha cerca de client: per això, la llista.
              isWeek && "lg:hidden",
            )}
          />
          <div className="md:hidden">{showAllButton}</div>
        </div>
      </div>

      <div className={dayOnly}>
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
        Toca un forat lliure per crear-hi una reserva amb aquell professional i aquella hora, o una sessió per obrir-ne la fitxa. Un grup amb places et deixa apuntar-hi qualsevol client.
      </p>
      </div>

      {/* ── La setmana (només a l'ordinador) ──────────────────────────────── */}
      {isWeek && (
        <div className="hidden lg:block" data-grid="week">
          {!now ? (
            <GridPlaceholder />
          ) : weekDays.length && shownCount ? (
            <AdminWeek
              days={weekDays}
              now={now}
              palette={palette}
              laneHeight={laneHeight}
              dayHref={(k) => `${nav.basePath}?dia=${k}`}
              proHref={(k, id) => `${nav.basePath}?dia=${k}&pro=${encodeURIComponent(id)}`}
              onOpen={open}
              // El forat diu el professional i el dia; el toc, la mitja hora.
              onFree={(at, services, proId) => {
                const pro = trainerOf(proId);
                if (pro) setCreating({ at, services: service && services.includes(service) ? [service] : services, trainer: pro });
              }}
              highlight={creating ? { proId: creating.trainer.id, at: creating.at } : null}
            />
          ) : (
            <NoneVisible />
          )}
          <p className="mt-3 text-xs text-brand-muted">
            Toca un forat lliure a l&apos;hora on vols crear-hi una reserva, una sessió, un grup o una prova per obrir-ne la fitxa, i «Obrir el dia» o el nom d&apos;un professional per anar a aquell dia.
          </p>
        </div>
      )}

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
          onJoin={
            list.join
              ? () => {
                  const j = list.join!;
                  setList(null);
                  setCreating({
                    at: j.at,
                    services: ["grupo_reducido"],
                    trainer: j.trainer,
                    group: { count: j.count },
                  });
                }
              : undefined
          }
          waitlist={list.waitlist}
          onClose={() => setList(null)}
        />
      )}
      {creating && (
        <CreateSlotSheet
          at={creating.at}
          services={creating.services}
          group={creating.group}
          trainer={creating.trainer}
          searchClients={searchClientsAction}
          createAction={createFromSlotAction}
          onClose={() => setCreating(null)}
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

const nextFmt = new Intl.DateTimeFormat("ca-ES", { weekday: "short", day: "numeric" });

/** El «Pròxim forat» d'una columna: quan és, i un toc per anar-hi. */
function NextFreeButton({
  next,
  today,
  onGo,
}: {
  next: { at: Date; services: ServiceType[] } | null;
  today: string;
  onGo: () => void;
}) {
  if (!next)
    return (
      <p className="mt-1 text-[11px] leading-tight text-brand-muted" data-next-free="">
        Cap forat en {NEXT_FREE_DAYS} dies
      </p>
    );
  const when = `${localDateStr(next.at) === today ? "avui" : nextFmt.format(next.at)} · ${hhmm(next.at)}`;
  return (
    <button
      type="button"
      onClick={onGo}
      data-next-free={next.at.toISOString()}
      aria-label={`Pròxim forat: ${when}`}
      className={`mt-1 flex min-h-11 w-full flex-col items-center justify-center rounded-md border border-dashed px-1 text-[11px] leading-tight text-brand-dark hover:bg-emerald-50 active:bg-emerald-100 ${TAP}`}
      style={{ borderColor: `${FREE_COLOR}80`, backgroundColor: `${FREE_COLOR}0d` }}
    >
      <span className="font-bold" style={{ color: FREE_COLOR }}>
        Pròxim forat
      </span>
      <span className="truncate">{when}</span>
    </button>
  );
}
