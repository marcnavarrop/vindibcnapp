"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, Hourglass } from "lucide-react";
import { GROUP_CAPACITY, SERVICE_LABELS } from "@/lib/labels";
import { colorOfService, type ColorPalette } from "@/lib/colors";
import { TAP, clsx } from "@/lib/utils";
import { ATTENTION } from "@/components/agenda-pieces";
import type { Entry, FreeRun } from "@/components/trainer-grid";
import type { ServiceType } from "@/types/database";

/*
 * EL MODE «SETMANA» DE L'AGENDA DE L'ADMIN (només a l'ordinador).
 *
 * La setmana del centre en una pantalla: cada dia és una banda i, a dins, una
 * franja per professional amb el temps d'esquerra a dreta. És la direcció B de
 * la proposta de l'agenda, que es va deixar per a l'ordinador.
 *
 * Aquest component només pinta: el càlcul (què hi ha a cada franja, els forats,
 * l'ocupació) el fa `AdminGrid`, amb les mateixes peces que la vista de dia, i
 * les fitxes que s'obren en tocar també són les seves.
 *
 * LES SENYALS, I NO NOMÉS EL COLOR
 *
 * El taronja és el color del grup a tota l'app i es queda només per a ell. El
 * que demana feina porta un signe que s'entén en blanc i negre: «per marcar», un
 * anell sòlid i el cercle amb l'exclamació; una prova pendent, la vora
 * discontínua i el rellotge de sorra. Totes dues en blau fosc (`ATTENTION`), que
 * no xoca amb cap servei.
 */

export { ATTENTION };
const FREE_INK = "#15803d";

const SHORT: Record<ServiceType, string> = {
  ep_individual: "EP",
  ep_parejas: "Par.",
  grupo_reducido: "Grup",
  fisioterapia: "Fisio",
};

export type WeekLane = {
  pro: { id: string; name: string; color: string };
  /** Ocupació del dia (0..1), la de `agendaLoad`; `null` si no té horari. */
  load: number | null;
  /** Els trams del seu horari, en slots: [inici, final). */
  schedule: [number, number][];
  entries: Entry[];
  free: FreeRun[];
  blocks: { from: number; to: number; reason: string | null }[];
  /** Les entrades que demanen «Per marcar» (vegeu `isToMarkAge`). */
  toMark: Set<string>;
  /** Gent en espera per sessió: instant (ms) → quants. */
  waiting: Map<number, number>;
};

export type WeekDay = {
  key: string;
  date: Date;
  isToday: boolean;
  lanes: WeekLane[];
  /** Els encesos que aquell dia no tenen ni horari ni res: una línia de text. */
  off: string[];
  summary: { sessions: number; full: number; waiting: number; toMark: number; freeHours: number };
};

const dayFmt = new Intl.DateTimeFormat("ca-ES", { weekday: "short", day: "numeric", month: "short" });
const hhmmFmt = new Intl.DateTimeFormat("ca-ES", { hour: "2-digit", minute: "2-digit" });

function shortName(name: string): string {
  const [first, second] = name.trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : first;
}
const slotOf = (d: Date) => d.getHours() * 2 + d.getMinutes() / 30;
const slotHHMM = (s: number) =>
  `${String(Math.floor(s / 2)).padStart(2, "0")}:${s % 2 ? "30" : "00"}`;

/*
 * L'eix d'hores, el mateix per a tota la setmana: de la primera hora en què hi
 * ha alguna cosa a l'última. Les hores buides de tothom que queden enmig (el
 * migdia, si ningú hi treballa) es pleguen en una ratlla estreta.
 */
type Col = { from: number; to: number; weight: number; fold: boolean };
const FOLD_WEIGHT = 0.3;

function buildAxis(days: WeekDay[]): { cols: Col[]; total: number } {
  const used = new Set<number>();
  const mark = (a: number, b: number) => {
    for (let h = Math.floor(a / 2); h < Math.ceil(b / 2); h++) used.add(h);
  };
  for (const d of days)
    for (const l of d.lanes) {
      for (const [a, b] of l.schedule) mark(a, b);
      for (const e of l.entries) mark(slotOf(e.start), slotOf(e.start) + 2);
      for (const b of l.blocks) mark(b.from, b.to);
    }
  if (used.size === 0) for (let h = 9; h < 14; h++) used.add(h);
  const hours = [...used].sort((a, b) => a - b);
  const cols: Col[] = [];
  for (let h = hours[0]; h <= hours[hours.length - 1]; h++) {
    if (used.has(h)) {
      cols.push({ from: h, to: h + 1, weight: 1, fold: false });
      continue;
    }
    const start = h;
    while (!used.has(h + 1)) h++;
    cols.push({ from: start, to: h + 1, weight: FOLD_WEIGHT, fold: true });
  }
  return { cols, total: cols.reduce((n, c) => n + c.weight, 0) };
}

export function AdminWeek({
  days,
  now,
  palette,
  laneHeight,
  dayHref,
  proHref,
  onOpen,
  onFree,
  highlight,
}: {
  days: WeekDay[];
  now: Date;
  palette: ColorPalette;
  /** Alçada de cada franja, segons quants professionals hi ha. */
  laneHeight: number;
  dayHref: (key: string) => string;
  proHref: (key: string, proId: string) => string;
  onOpen: (e: Entry) => void;
  /** Tocar un forat: la mitja hora tocada. Sense, el forat no es pot tocar. */
  onFree?: (at: Date, services: ServiceType[], proId: string) => void;
  /** La mitja hora que s'està creant (la fulla de crear oberta): es marca. */
  highlight?: { proId: string; at: Date } | null;
}) {
  const { cols, total } = buildAxis(days);
  /*
   * El globus en passar el ratón (o en arribar-hi amb el teclat): el detall de
   * la peça, que a la franja no hi cap. Va dins del tauler, que és relatiu.
   */
  const boardRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ lines: string[]; x: number; y: number } | null>(null);
  const showTip = (el: HTMLElement, lines: string[]) => {
    const box = boardRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    const x = Math.min(Math.max(0, r.left - box.left), box.width - 260);
    setTip({ lines, x, y: r.bottom - box.top + 4 });
  };
  const tipHandlers = (lines: string[]) => ({
    onMouseEnter: (ev: React.MouseEvent<HTMLElement>) => showTip(ev.currentTarget, lines),
    onFocus: (ev: React.FocusEvent<HTMLElement>) => showTip(ev.currentTarget, lines),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  // Posició (en %) d'un slot dins de l'àrea del temps.
  const pct = (slot: number): number => {
    const h = slot / 2;
    let acc = 0;
    for (const c of cols) {
      if (h < c.from) break;
      if (h < c.to) return ((acc + (c.fold ? c.weight / 2 : (h - c.from) * c.weight)) / total) * 100;
      acc += c.weight;
    }
    return (Math.min(acc, total) / total) * 100;
  };
  const span = (a: number, b: number) => ({ left: `${pct(a)}%`, width: `${Math.max(0, pct(b) - pct(a))}%` });

  return (
    <div ref={boardRef} className="relative rounded-xl border border-brand-border bg-white" data-week>
      {/* L'eix: es queda a dalt en fer scroll. */}
      <div className="sticky top-0 z-20 flex rounded-t-xl border-b border-brand-border bg-white" data-week-axis>
        <div className="w-32 shrink-0 border-r border-brand-border" />
        <div className="relative h-6 flex-1">
          {cols.map((c) =>
            c.fold ? (
              <span
                key={`f${c.from}`}
                className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,#f4f2f5_0_4px,#ebe7ee_4px_8px)]"
                style={span(c.from * 2, c.to * 2)}
                title={`De ${c.from} a ${c.to} h no treballa ningú`}
                aria-hidden
              />
            ) : (
              <span
                key={c.from}
                className="absolute top-1 pl-1 text-[11px] font-bold text-brand-muted tabular-nums"
                style={{ left: `${pct(c.from * 2)}%` }}
              >
                {c.from}h
              </span>
            ),
          )}
        </div>
      </div>

      {days.map((d) => (
        <section key={d.key} aria-label={dayFmt.format(d.date)} data-week-day={d.key}>
          <DayHeader d={d} href={dayHref(d.key)} />
          {d.lanes.map((l) => (
            <div key={l.pro.id} className="flex" style={{ height: laneHeight }} data-week-lane={l.pro.id}>
              <Link
                href={proHref(d.key, l.pro.id)}
                className={`flex w-32 shrink-0 items-center gap-1.5 border-r border-brand-border px-2 text-[13px] font-bold text-brand-dark hover:bg-brand-bg ${TAP}`}
                aria-label={`${l.pro.name}, ${dayFmt.format(d.date)}: ${l.load === null ? "sense horari" : `${Math.round(l.load * 100)} % ocupat`}. Obrir el dia`}
              >
                <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: l.pro.color }} />
                <span className="truncate">{l.pro.name}</span>
                <span className="ml-auto text-[11px] text-brand-muted tabular-nums" data-load>
                  {l.load === null ? "—" : `${Math.round(l.load * 100)} %`}
                </span>
              </Link>
              <div className="relative flex-1 overflow-hidden bg-brand-bg">
                {/* Hores d'una en una */}
                {cols.map((c) =>
                  c.fold ? (
                    <span
                      key={`f${c.from}`}
                      aria-hidden
                      className="absolute inset-y-0 z-[1] bg-[repeating-linear-gradient(135deg,#f4f2f5_0_4px,#ebe7ee_4px_8px)]"
                      style={span(c.from * 2, c.to * 2)}
                    />
                  ) : null,
                )}
                {l.schedule.map(([a, b]) => (
                  <span key={`s${a}`} aria-hidden className="absolute inset-y-0 bg-white" style={span(a, b)} />
                ))}
                {cols
                  .filter((c) => !c.fold)
                  .map((c) => (
                    <span key={`l${c.from}`} aria-hidden className="absolute inset-y-0 border-l border-[#efebf1]" style={{ left: `${pct(c.from * 2)}%` }} />
                  ))}
                {l.blocks.map((b) => (
                  <span
                    key={`b${b.from}`}
                    className="absolute inset-y-0.5 z-[2] flex items-center overflow-hidden rounded border border-[#d9cfdb] bg-[repeating-linear-gradient(135deg,rgba(100,34,99,.10)_0_5px,transparent_5px_10px)] px-1.5 text-[11.5px] font-bold whitespace-nowrap text-brand-purple-dark"
                    style={span(b.from, b.to)}
                    {...tipHandlers([
                      `${l.pro.name} · bloquejat ${slotHHMM(Math.floor(b.from))}–${slotHHMM(Math.ceil(b.to))}`,
                      b.reason ? `Motiu: ${b.reason}` : "Sense motiu",
                    ])}
                    data-week-block
                  >
                    <span className="truncate">{b.reason || "Bloquejat"}</span>
                  </span>
                ))}
                {l.free.map((f) => (
                  <FreeBlock
                    key={`r${f.from}`}
                    f={f}
                    day={d.date}
                    pro={l.pro}
                    style={span(f.from, f.to)}
                    onFree={onFree}
                    tip={tipHandlers([
                      `${l.pro.name} · ${dayFmt.format(d.date)} · lliure ${slotHHMM(f.from)}–${slotHHMM(f.to)}`,
                      `Hi cap: ${f.services.map((x) => SERVICE_LABELS[x]).join(", ")}`,
                      ...(onFree ? ["Toca l'hora on vols crear la sessió."] : []),
                    ])}
                  />
                ))}
                {highlight && highlight.proId === l.pro.id && localKey(highlight.at) === d.key && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0.5 z-[3] rounded border-2 border-[#15803d] bg-[rgba(22,163,74,.22)]"
                    style={span(slotOf(highlight.at), slotOf(highlight.at) + 2)}
                    data-week-pick
                  />
                )}
                {l.entries.map((e) => (
                  <EntryBlock
                    key={e.id}
                    e={e}
                    palette={palette}
                    toMark={l.toMark.has(e.id)}
                    waiting={l.waiting.get(e.start.getTime()) ?? 0}
                    past={e.end.getTime() <= now.getTime()}
                    style={span(slotOf(e.start), slotOf(e.end) || 48)}
                    onOpen={onOpen}
                    tip={tipHandlers}
                  />
                ))}
                {d.isToday && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 z-[3] bg-[rgba(240,238,242,.45)]"
                      style={{ width: `${pct(slotOf(now))}%` }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-[4] border-l-2 border-brand-orange"
                      style={{ left: `${pct(slotOf(now))}%` }}
                      data-now
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          {d.off.length > 0 && (
            <p className="border-t border-dashed border-brand-border bg-[#fbfafc] px-2 py-0.5 text-[11.5px] text-brand-muted" data-week-off>
              Sense horari aquest dia: {d.off.join(", ")}
            </p>
          )}
        </section>
      ))}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-30 w-64 rounded-lg bg-brand-dark px-3 py-2 text-[12.5px] leading-snug text-white shadow-lg"
          style={{ left: tip.x, top: tip.y }}
          data-week-tip
        >
          {tip.lines.map((t, i) => (
            <p key={i} className={i === 0 ? "font-bold" : "text-white/80"}>
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DayHeader({ d, href }: { d: WeekDay; href: string }) {
  const s = d.summary;
  const parts: React.ReactNode[] = [`${s.sessions} ${s.sessions === 1 ? "sessió" : "ses."}`];
  if (s.full)
    parts.push(
      <b key="full" className="text-brand-dark">
        {s.full} {s.full === 1 ? "grup ple" : "grups plens"}
        {s.waiting ? ` · ${s.waiting} en espera` : ""}
      </b>,
    );
  if (s.toMark)
    parts.push(
      <b key="mark" className="inline-flex items-center gap-1" style={{ color: ATTENTION }}>
        <CircleAlert aria-hidden className="h-3.5 w-3.5" />
        {s.toMark} per marcar
      </b>,
    );
  if (s.freeHours) parts.push(`${s.freeHours.toLocaleString("ca-ES")} h lliures`);
  return (
    <div
      className="sticky top-6 z-10 flex h-7 items-center gap-3 border-t border-b border-t-[#e9e4ec] border-b-[#f0edf1] bg-[#faf8fb] px-2 text-[12.5px]"
      data-week-head
    >
      <span className={clsx("shrink-0 text-[13px] font-bold whitespace-nowrap uppercase", d.isToday ? "text-brand-purple" : "text-brand-dark")}>
        {dayFmt.format(d.date)}
        {d.isToday ? " · avui" : ""}
      </span>
      <span className="flex min-w-0 items-center gap-2 truncate text-brand-muted" data-week-summary>
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {p}
          </span>
        ))}
      </span>
      <Link
        href={href}
        className={`ml-auto shrink-0 text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
        data-week-open-day
      >
        Obrir el dia →
      </Link>
    </div>
  );
}

function EntryBlock({
  e,
  palette,
  toMark,
  waiting,
  past,
  style,
  onOpen,
  tip,
}: {
  e: Entry;
  palette: ColorPalette;
  toMark: boolean;
  waiting: number;
  past: boolean;
  style: React.CSSProperties;
  onOpen: (e: Entry) => void;
  tip: (lines: string[]) => Record<string, unknown>;
}) {
  const at = hhmmFmt.format(e.start);
  let label: React.ReactNode;
  let aria: string;
  let lines: string[];
  let look: React.CSSProperties = {};
  let cls = "";
  if (e.kind === "group") {
    const c = colorOfService(palette, "grupo_reducido");
    look = { backgroundColor: `${c}26`, boxShadow: `inset 3px 0 0 ${c}` };
    label = (
      <>
        <span className="truncate">Grup</span>
        <span className="rounded-sm bg-white px-1 text-[#b8470c]">
          {e.list.length}/{GROUP_CAPACITY}
        </span>
        {/* Blanc sobre el taronja del grup feia 2,8:1; sobre l'enfosquit, 5,3. */}
        {waiting > 0 && <span className="rounded-sm bg-group-ink px-1 text-white">+{waiting}</span>}
      </>
    );
    aria = `Grup ${at}, ${e.list.length} de ${GROUP_CAPACITY}${waiting ? `, ${waiting} en espera` : ""}`;
    lines = [
      `Grup · ${at} · ${e.list.length}/${GROUP_CAPACITY}${waiting ? ` · +${waiting} en espera` : ""}`,
      e.list.map((r) => shortName(r.clientName)).join(", "),
    ];
  } else if (e.kind === "trial") {
    const pending = e.t.status === "pending";
    if (pending) {
      cls = "border-[1.5px] border-dashed bg-white";
      look = { borderColor: ATTENTION, color: ATTENTION };
    } else {
      // Confirmada: vora sòlida, com a la vista de dia.
      cls = "border-[1.5px] border-solid";
      look = { borderColor: ATTENTION, backgroundColor: `${ATTENTION}12` };
    }
    label = (
      <>
        {pending && <Hourglass aria-hidden className="h-3 w-3 shrink-0" data-trial-pending />}
        <span className="truncate">Prova · {shortName(e.t.fullName)}</span>
      </>
    );
    aria = `Prova ${pending ? "pendent" : "confirmada"} ${at}, ${e.t.fullName}`;
    lines = [`Prova ${pending ? "pendent de resposta" : "confirmada"} · ${at}`, `${e.t.fullName} · ${SERVICE_LABELS[e.t.serviceType]}`];
  } else {
    const c = colorOfService(palette, e.r.serviceType);
    look = { backgroundColor: `${c}26`, boxShadow: `inset 3px 0 0 ${c}` };
    label = <span className="truncate">{shortName(e.r.clientName)}</span>;
    aria = `${at}, ${e.r.clientName}, ${SERVICE_LABELS[e.r.serviceType]}`;
    lines = [`${at} · ${e.r.clientName}`, SERVICE_LABELS[e.r.serviceType]];
  }
  if (toMark) {
    // Anell sòlid + icona: «per marcar» s'entén sense color.
    look = { ...look, boxShadow: `inset 0 0 0 2px ${ATTENTION}` };
    aria += ", per marcar";
    lines.push("Per marcar: ja ha passat i segueix reservada.");
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(e)}
      aria-label={aria}
      {...tip(lines)}
      data-week-entry={e.kind}
      data-to-mark={toMark || undefined}
      className={clsx(
        "absolute inset-y-0.5 z-[2] flex items-center gap-1 overflow-hidden rounded px-1.5 text-left text-[12px] font-bold whitespace-nowrap text-brand-charcoal",
        past && !toMark && "opacity-50",
        cls,
        TAP,
      )}
      style={{ ...style, ...look }}
    >
      {label}
      {toMark && <CircleAlert aria-hidden className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: ATTENTION }} data-mark-icon />}
    </button>
  );
}

function FreeBlock({
  f,
  day,
  pro,
  style,
  onFree,
  tip,
}: {
  f: FreeRun;
  day: Date;
  pro: { id: string; name: string };
  style: React.CSSProperties;
  onFree?: (at: Date, services: ServiceType[], proId: string) => void;
  tip: Record<string, unknown>;
}) {
  const label = f.services.map((s) => SHORT[s]).join(" · ");
  const desc = `${pro.name} · lliure ${slotHHMM(f.from)}–${slotHHMM(f.to)} · ${f.services.map((s) => SERVICE_LABELS[s]).join(", ")}`;
  const cls =
    "absolute inset-y-0.5 z-[2] flex items-center overflow-hidden rounded border-[1.5px] border-dashed border-[rgba(22,163,74,.55)] bg-[rgba(22,163,74,.06)] px-1.5 text-[11.5px] font-bold whitespace-nowrap";
  if (!onFree)
    return (
      <span className={cls} style={{ ...style, color: FREE_INK }} {...tip} data-week-free>
        <span className="truncate">{label}</span>
      </span>
    );
  return (
    <button
      type="button"
      className={clsx(cls, "text-left hover:bg-[rgba(22,163,74,.14)]", TAP)}
      style={{ ...style, color: FREE_INK }}
      {...tip}
      aria-label={`${desc}. Crear una sessió`}
      data-week-free
      onClick={(ev) => {
        // La mitja hora tocada, dins dels inicis possibles del tram.
        const rect = ev.currentTarget.getBoundingClientRect();
        const frac = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0;
        const k = Math.max(0, Math.min(Math.floor(frac * (f.to - f.from)), f.lastStart - f.from));
        const at = new Date(day);
        at.setHours(0, (f.from + k) * 30, 0, 0);
        onFree(at, f.services, pro.id);
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
