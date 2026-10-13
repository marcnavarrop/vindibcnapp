"use client";

import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SESSION_DURATION_MINUTES } from "@/lib/labels";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { clsx, TAP } from "@/lib/utils";
import {
  weekdayOf,
  hourToSlot,
  isOnTheHour,
  slotToHHMM,
  SLOT_MINUTES,
  type TrainerRuleLite,
  type TrainerBlockLite,
} from "@/lib/availability-slots";
import {
  TRIAL_SERVICE,
  TRIAL_MIN_ADVANCE_HOURS,
  TRIAL_MAX_ADVANCE_DAYS,
} from "@/lib/data/trial-bookings.constants";
// (valor compartit sense `server-only`, segur en un client component)
import type { PublicTrialData } from "@/lib/data/trial-bookings";
import { freeServicesAt, occupancyFromSlotKeys, type OccupancyLookup } from "@/lib/free-slots";
import type { TrialFormState } from "@/app/prova/actions";
import { CenterContactLine } from "@/components/center-contact-line";

const HOUR = 60 * 60 * 1000;

/**
 * Una sessió de prova és una sessió estàndard del centre: no en té de pròpia.
 * Bessó de `TRIAL_DURATION_MINUTES` a lib/data/trial-bookings.ts i de
 * `v_trial_mins` a les migracions 0083 i 0084; si un dia canvia, canvia als tres.
 */
const TRIAL_DURATION = SESSION_DURATION_MINUTES;

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

/**
 * ¿Algun entrenador ofereix la prova en aquesta franja i està lliure?
 *
 * La regla és la de totes les pantalles (lib/free-slots.ts). Aquí l'ocupació
 * surt de `busy`, els slots ocupats que envia el servidor: la pàgina és pública
 * i no en rep res més.
 */
function slotIsFree(
  rules: TrainerRuleLite[],
  occupancy: OccupancyLookup,
  blocks: TrainerBlockLite[],
  date: Date,
  slot: number,
): boolean {
  const trainerIds = new Set(rules.map((r) => r.trainerId));
  for (const trainerId of trainerIds)
    if (
      freeServicesAt({
        rules,
        blocks,
        trainerId,
        date,
        slot,
        durationMinutes: TRIAL_DURATION,
        occupancy,
      }).has(TRIAL_SERVICE)
    )
      return true; // hi ha com a mínim un entrenador lliure
  return false;
}

export function TrialCalendar({
  data,
  action,
  openingHour = 7,
  closingHour = 22,
}: {
  data: PublicTrialData;
  action: CreateAction;
  /** Horari del centre (configurable per l'admin). */
  openingHour?: number;
  closingHour?: number;
}) {
  const t = useTranslations("trial");
  const locale = useLocale() as Locale;
  const dayNames = t.raw("days") as string[];
  const [view, setView] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0);
  const [slot, setSlot] = useState<Date | null>(null);
  /**
   * L'hora que ha obert el formulari, per tornar-hi el focus en tancar-lo.
   * Es desa en clicar i no amb `document.activeElement`: Safari no dona el
   * focus a un botó quan s'hi fa clic, i el focus acabava a l'inici de la
   * pàgina.
   */
  const openerRef = useRef<HTMLElement | null>(null);
  function openSlot(d: Date, el: HTMLElement) {
    openerRef.current = el;
    setSlot(d);
  }
  /**
   * Fins que no som al navegador no es pinta cap hora.
   *
   * Abans el calendari es pintava al servidor i obria sobre AVUI, que no té mai
   * cap hora lliure (la prova demana 24 h d'antelació): qui entrava veia la
   * rejilla sencera en blanc i havia d'endevinar que calia passar al dia
   * següent. Ara, en arribar al navegador, s'obre directament al primer dia amb
   * hores. Es fa aquí i no al servidor perquè el dia i l'hora de cada casella
   * són els del rellotge del navegador, com fins ara; al servidor no hi ha
   * aquest rellotge, i pintar-hi un altre dia faria saltar la pantalla.
   */
  const [ready, setReady] = useState(false);

  const occupancy = useMemo(
    () => occupancyFromSlotKeys(new Set(data.busy)),
    [data.busy],
  );
  const rules = data.rules;
  const blocks = data.blocks;

  const slots = useMemo(() => {
    const out: number[] = [];
    for (let s = hourToSlot(openingHour); s < hourToSlot(closingHour); s++)
      out.push(s);
    return out;
  }, [openingHour, closingHour]);

  /**
   * Les hores lliures d'un dia, calculades una sola vegada per dia.
   *
   * Abans cada casella de la rejilla tornava a fer el càlcul a cada render
   * (7 dies × 30 franges × cada professional), també en obrir el formulari o
   * escriure-hi. Ara cada dia es calcula el primer cop que es mira i es desa.
   */
  // Les dependències no s'usen a dins a propòsit: són el que, si canvia, ha de
  // buidar la memòria.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const freeCache = useMemo(() => new Map<string, Date[]>(), [rules, blocks, occupancy, slots]);
  const freeSlotsOf = useCallback(
    (day: Date): Date[] => {
      const key = day.toDateString();
      const cached = freeCache.get(key);
      if (cached) return cached;
      const now = Date.now();
      const minMs = now + TRIAL_MIN_ADVANCE_HOURS * HOUR;
      const maxMs = now + TRIAL_MAX_ADVANCE_DAYS * 24 * HOUR;
      const out: Date[] = [];
      for (const s of slots) {
        const cellDate = new Date(day);
        cellDate.setHours(0, s * SLOT_MINUTES, 0, 0);
        const ms = cellDate.getTime();
        if (ms >= minMs && ms <= maxMs && slotIsFree(rules, occupancy, blocks, cellDate, s))
          out.push(cellDate);
      }
      freeCache.set(key, out);
      return out;
    },
    [freeCache, slots, rules, occupancy, blocks],
  );

  /** El primer dia amb hores a partir de `from` (inclòs), o null si no n'hi ha cap. */
  const nextFreeDay = useCallback(
    (from: Date): Date | null => {
      const today = startOfDay(new Date());
      for (let i = 0; i <= TRIAL_MAX_ADVANCE_DAYS + 1; i++) {
        const d = addDays(startOfDay(from), i);
        if (d.getTime() - today.getTime() > (TRIAL_MAX_ADVANCE_DAYS + 1) * 24 * HOUR) break;
        if (freeSlotsOf(d).length) return d;
      }
      return null;
    },
    [freeSlotsOf],
  );

  useEffect(() => {
    // En mòbil, la vista de dia; a partir de 768 px hi cap la setmana sencera.
    const v = window.innerWidth < 768 ? "day" : "week";
    const first = nextFreeDay(new Date());
    setView(v);
    if (first) setOffset(offsetTo(v, first));
    setReady(true);
    // Només en arribar: després, qui mana és la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = useMemo(() => {
    if (view === "week") {
      const ws = addDays(startOfWeek(new Date()), offset * 7);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [addDays(startOfDay(new Date()), offset)];
  }, [view, offset]);

  const periodLabel = useMemo(() => {
    if (view === "week")
      return new Intl.DateTimeFormat(intlLocale(locale), {
        month: "long",
        year: "numeric",
      }).format(days[0]);
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(days[0]);
  }, [view, days, locale]);

  /** Nom accessible de cada hora: el dia i l'hora, no només «Lliure». */
  const slotName = useCallback(
    (d: Date) =>
      t("slotLabel", {
        when: new Intl.DateTimeFormat(intlLocale(locale), {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d),
      }),
    [t, locale],
  );

  // Si el que es mira no té cap hora, on hi ha la propera (per oferir el salt).
  const shownFree = ready ? days.flatMap((d) => freeSlotsOf(d)) : [];
  const jumpTo =
    ready && shownFree.length === 0
      ? nextFreeDay(addDays(days[days.length - 1], 1))
      : null;

  function goToDay(d: Date) {
    setOffset(offsetTo(view, d));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-brand-border">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                // Canviar de vista no torna a avui (buit): va al primer dia amb hores.
                const first = nextFreeDay(new Date());
                setView(v);
                setOffset(first ? offsetTo(v, first) : 0);
              }}
              className={clsx(
                "px-3 py-1.5 text-sm font-bold",
                TAP,
                view === v
                  ? "bg-brand-purple text-white active:bg-brand-purple-dark"
                  : "bg-white text-brand-tab hover:text-brand-dark active:bg-brand-bg",
              )}
            >
              {v === "day" ? t("day") : t("week")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <NavBtn label={t("prev")} onClick={() => setOffset((o) => o - 1)}>
            ‹
          </NavBtn>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className={`rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-charcoal hover:bg-brand-bg active:bg-brand-border ${TAP}`}
          >
            {t("today")}
          </button>
          <NavBtn label={t("next")} onClick={() => setOffset((o) => o + 1)}>
            ›
          </NavBtn>
        </div>
        <span
          aria-live="polite"
          className="text-sm font-bold text-brand-dark first-letter:uppercase"
        >
          {ready ? periodLabel : ""}
        </span>
      </div>

      {/* La norma de l'antelació, ABANS de les hores: és el que explica per
          què avui no n'hi ha cap. */}
      <p className="mb-3 text-xs text-brand-muted">
        {t("legend", {
          hours: TRIAL_MIN_ADVANCE_HOURS,
          days: TRIAL_MAX_ADVANCE_DAYS,
        })}
      </p>

      {!ready ? (
        <div
          className="rounded-2xl border border-brand-border bg-white p-6 text-center text-sm text-brand-muted"
          role="status"
        >
          {t("loading")}
        </div>
      ) : view === "day" ? (
        /* Vista de dia: només les hores lliures, en botons grans. Una rejilla
           de 07:00 a 22:00 en una sola columna eren 30 files per trobar-ne
           quatre, i la primera quedava sota el plec al mòbil. */
        <div className="rounded-2xl border border-brand-border bg-white p-3">
          {shownFree.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shownFree.map((d) => (
                <li key={d.getTime()}>
                  <button
                    type="button"
                    onClick={(e) => openSlot(d, e.currentTarget)}
                    aria-label={slotName(d)}
                    className={`flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-purple/10 px-2 py-2 text-sm font-bold text-brand-purple hover:bg-brand-purple/20 active:bg-brand-purple/25 ${TAP}`}
                  >
                    {slotToHHMM(d.getHours() * (60 / SLOT_MINUTES) + d.getMinutes() / SLOT_MINUTES)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <NoFree jumpTo={jumpTo} onJump={goToDay} />
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
            <div className="min-w-[48rem]">
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
                        {dayNames[weekdayOf(d)]}
                      </div>
                      <div className="text-sm font-bold text-brand-dark">
                        {d.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Files de mitja hora. Només la fila en punt porta etiqueta, i la
                  línia del mig és més fluixa: cada hora es llegeix com un bloc. */}
              {slots.map((s) => (
                <div
                  key={s}
                  className={clsx(
                    "grid border-b last:border-0",
                    isOnTheHour(s) ? "border-brand-border/30" : "border-brand-border",
                  )}
                  style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}
                >
                  <div className="px-1 py-2 text-right text-xs font-bold text-brand-muted">
                    {isOnTheHour(s) ? slotToHHMM(s) : ""}
                  </div>
                  {days.map((d, dayIdx) => {
                    const cell = freeSlotsOf(d).find(
                      (x) => x.getHours() * 60 + x.getMinutes() === s * SLOT_MINUTES,
                    );
                    return (
                      <div
                        key={dayIdx}
                        className="min-h-[2rem] border-l border-brand-border p-1"
                      >
                        {cell && (
                          <button
                            type="button"
                            onClick={(e) => openSlot(cell, e.currentTarget)}
                            aria-label={slotName(cell)}
                            className={`block h-full w-full rounded-md bg-brand-purple/10 px-1.5 py-1 text-[11px] font-bold text-brand-purple hover:bg-brand-purple/20 active:bg-brand-bg ${TAP}`}
                          >
                            {t("free")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {shownFree.length === 0 && (
            <div className="mt-3 rounded-2xl border border-brand-border bg-white p-3">
              <NoFree jumpTo={jumpTo} onJump={goToDay} />
            </div>
          )}
        </>
      )}

      {slot && (
        <RequestModal
          slot={slot}
          action={action}
          onClose={() => {
            setSlot(null);
            openerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Quants passos (dies o setmanes) hi ha d'avui fins a `target`, segons la vista. */
function offsetTo(view: "day" | "week", target: Date): number {
  const DAY = 24 * HOUR;
  if (view === "day")
    return Math.round((startOfDay(target).getTime() - startOfDay(new Date()).getTime()) / DAY);
  return Math.round(
    (startOfWeek(target).getTime() - startOfWeek(new Date()).getTime()) / (7 * DAY),
  );
}

/** Cap hora en el que es mira: ho diu, i ofereix anar al primer dia que en té. */
function NoFree({
  jumpTo,
  onJump,
}: {
  jumpTo: Date | null;
  onJump: (d: Date) => void;
}) {
  const t = useTranslations("trial");
  const locale = useLocale() as Locale;
  if (!jumpTo)
    return (
      <div className="flex flex-col gap-2 text-sm text-brand-charcoal">
        <p>{t("noneAhead")}</p>
        <CenterContactLine className="text-sm" />
      </div>
    );
  const label = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(jumpTo);
  return (
    <div className="flex flex-col items-start gap-2 text-sm text-brand-charcoal">
      <p>{t("noFreeHere")}</p>
      <button
        type="button"
        onClick={() => onJump(jumpTo)}
        className={`rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
      >
        {t("goToFirstFree", { day: label })}
      </button>
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
  const t = useTranslations("trial");
  const te = useTranslations("trial.errors");
  const locale = useLocale() as Locale;
  const [state, formAction] = useActionState(action, {} as TrialFormState);
  const titleId = useId();
  const errorId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(slot);

  /**
   * Diàleg de debò per a qui no hi veu o va amb teclat: en obrir-se, el focus
   * hi entra (al primer camp); Escape el tanca; el tabulador hi queda tancat a
   * dins; i en tancar-se el focus torna a l'hora que s'havia triat (ho fa
   * qui l'obre, a `onClose`).
   */
  // L'efecte s'arma un sol cop; `onClose` hi arriba per ref perquè una funció
  // nova del pare no torni a portar el focus al primer camp a mig escriure.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const box = boxRef.current;
    box?.querySelector<HTMLElement>("input:not([type=hidden]), button")?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = [
        ...box.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea",
        ),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // En canviar de pantalla (enviat bé), el focus va al missatge de confirmació.
  useEffect(() => {
    if (state.ok) boxRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [state.ok]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {state.ok ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 id={titleId} tabIndex={-1} className="text-lg font-bold text-brand-dark outline-none">
              {t("okTitle")}
            </h2>
            {/* Text ric: el "pendent de confirmació" va destacat i cada idioma
                el col·loca on li toca, que no és el mateix lloc de la frase. */}
            <p className="text-sm text-brand-muted">
              {t.rich("okBody", {
                strong: (chunks) => (
                  <strong className="text-brand-dark">{chunks}</strong>
                ),
              })}
            </p>
            <CenterContactLine className="text-xs" />
            <button
              type="button"
              onClick={onClose}
              className={`mt-2 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
            >
              {t("close")}
            </button>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="text-lg font-bold text-brand-dark">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">{when}</p>
            <form action={formAction} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="scheduledAt" value={toLocalInput(slot)} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-bold text-brand-charcoal">
                  {t("form.fullName")}
                </span>
                <input
                  name="fullName"
                  required
                  className={inputCls}
                  autoComplete="name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-bold text-brand-charcoal">
                  {t("form.email")}
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  className={inputCls}
                  autoComplete="email"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-bold text-brand-charcoal">
                  {t("form.phone")}
                </span>
                <input
                  name="phone"
                  type="tel"
                  required
                  className={inputCls}
                  autoComplete="tel"
                />
              </label>
              <label className="flex items-start gap-2 text-sm text-brand-charcoal">
                <input type="checkbox" name="consent" className="mt-1 h-4 w-4" />
                <span>
                  {t.rich("form.consent", {
                    link: (chunks) => (
                      <Link
                        href="/legal/privacitat"
                        target="_blank"
                        className="font-bold text-brand-purple underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </label>

              {state.errorCode && (
                <p id={errorId} role="alert" className="text-sm text-error">
                  {te(state.errorCode, {
                    hours: TRIAL_MIN_ADVANCE_HOURS,
                    days: TRIAL_MAX_ADVANCE_DAYS,
                  })}
                </p>
              )}

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="submit"
                  className={`flex-1 rounded-lg bg-brand-purple px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
                >
                  {t("form.submit")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold text-brand-tab hover:text-brand-dark active:bg-brand-bg ${TAP}`}
                >
                  {t("form.cancel")}
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
  "rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20";

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
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold text-brand-charcoal hover:bg-brand-bg active:opacity-70 ${TAP}`}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
