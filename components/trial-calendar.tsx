"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "@/lib/utils";
import {
  weekdayOf,
  localDateStr,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import { TRIAL_SERVICE } from "@/lib/data/trial-bookings.constants";
// (valor compartit sense `server-only`, segur en un client component)
import type { PublicTrialData } from "@/lib/data/trial-bookings";
import type { TrialFormState } from "@/app/prova/actions";

const OPEN = 7;
const CLOSE = 22;
const HOUR = 60 * 60 * 1000;
const DAY_NAMES = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];

type CreateAction = (
  prev: TrialFormState,
  formData: FormData,
) => Promise<TrialFormState>;

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

/** ¿Algun entrenador ofereix la prova en aquesta franja i està lliure? */
function slotIsFree(
  rules: TrainerRuleLite[],
  busy: Set<string>,
  date: Date,
  h: number,
): boolean {
  const wd = weekdayOf(date);
  const day = localDateStr(date);
  for (const r of rules) {
    if (r.weekday !== wd) continue;
    if (day < r.validFrom) continue;
    if (r.validUntil && day > r.validUntil) continue;
    if (h < r.startHour || h >= r.endHour) continue;
    if (!r.serviceTypes.includes(TRIAL_SERVICE)) continue;
    if (busy.has(`${r.trainerId}|${day}|${h}`)) continue;
    return true; // hi ha com a mínim un entrenador lliure
  }
  return false;
}

export function TrialCalendar({
  data,
  action,
}: {
  data: PublicTrialData;
  action: CreateAction;
}) {
  const [view, setView] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0);
  const [slot, setSlot] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setView("day");
  }, []);

  const busy = useMemo(() => new Set(data.busy), [data.busy]);
  const rules = data.rules;

  const minMs = Date.now() + 24 * HOUR;
  const maxMs = Date.now() + 30 * 24 * HOUR;

  const days = useMemo(() => {
    if (view === "week") {
      const ws = addDays(startOfWeek(new Date()), offset * 7);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    const d = addDays(new Date(), offset);
    d.setHours(0, 0, 0, 0);
    return [d];
  }, [view, offset]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = OPEN; h < CLOSE; h++) out.push(h);
    return out;
  }, []);

  const periodLabel = useMemo(() => {
    if (view === "week")
      return new Intl.DateTimeFormat("ca-ES", {
        month: "long",
        year: "numeric",
      }).format(days[0]);
    return new Intl.DateTimeFormat("ca-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(days[0]);
  }, [view, days]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-2">
          <NavBtn label="Anterior" onClick={() => setOffset((o) => o - 1)}>
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
        <div className={view === "week" ? "min-w-[48rem]" : ""}>
          <div
            className="grid border-b border-brand-border"
            style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}
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
                  <div className="text-sm font-bold text-brand-dark">
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
              style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}
            >
              <div className="px-1 py-2 text-right text-xs font-bold text-brand-muted">
                {pad(h)}:00
              </div>
              {days.map((d, dayIdx) => {
                const cellDate = new Date(d);
                cellDate.setHours(h, 0, 0, 0);
                const t = cellDate.getTime();
                const bookable =
                  t >= minMs &&
                  t <= maxMs &&
                  slotIsFree(rules, busy, cellDate, h);
                return (
                  <div
                    key={dayIdx}
                    className="min-h-[3rem] border-l border-brand-border p-1"
                  >
                    {bookable && (
                      <button
                        type="button"
                        onClick={() => setSlot(cellDate)}
                        className="block h-full w-full rounded-md bg-brand-purple/10 px-1.5 py-1 text-[11px] font-bold text-brand-purple hover:bg-brand-purple/20"
                      >
                        Lliure
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Tria una franja lliure per demanar la teva sessió de prova gratuïta. Cal
        un mínim de 24 h d&apos;antelació. Rebràs la confirmació de l&apos;entrenador/a.
      </p>

      {slot && (
        <RequestModal
          slot={slot}
          action={action}
          onClose={() => setSlot(null)}
        />
      )}
    </div>
  );
}

function RequestModal({
  slot,
  action,
  onClose,
}: {
  slot: Date;
  action: CreateAction;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(action, {} as TrialFormState);
  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(slot);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {state.ok ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-lg font-bold text-brand-dark">
              Sol·licitud rebuda!
            </h2>
            <p className="text-sm text-brand-muted">
              La teva sessió de prova està{" "}
              <strong className="text-brand-dark">pendent de confirmació</strong>{" "}
              per part de l&apos;entrenador/a. T&apos;avisarem per correu quan la
              confirmi. Gràcies!
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light"
            >
              Tancar
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-brand-dark">
              Sessió de prova gratuïta
            </h2>
            <p className="mt-1 text-sm text-brand-muted capitalize">{when}</p>
            <form action={formAction} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="scheduledAt" value={toLocalInput(slot)} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-bold text-brand-charcoal">Nom complet</span>
                <input
                  name="fullName"
                  required
                  className={inputCls}
                  autoComplete="name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-bold text-brand-charcoal">Correu</span>
                <input
                  name="email"
                  type="email"
                  required
                  className={inputCls}
                  autoComplete="email"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-bold text-brand-charcoal">Telèfon</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  className={inputCls}
                  autoComplete="tel"
                />
              </label>
              <label className="flex items-start gap-2 text-sm text-brand-charcoal">
                <input type="checkbox" name="consent" className="mt-1" />
                <span>
                  He llegit i accepto la{" "}
                  <Link
                    href="/legal/privacitat"
                    target="_blank"
                    className="font-bold text-brand-purple underline"
                  >
                    Política de Privacitat
                  </Link>
                  .
                </span>
              </label>

              {state.error && (
                <p className="text-sm text-error">{state.error}</p>
              )}

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light"
                >
                  Demanar sessió
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
          </>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple";

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
