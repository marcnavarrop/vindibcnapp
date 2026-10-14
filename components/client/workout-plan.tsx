"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AssignedExercises } from "@/components/client/assigned-exercises";
import { markDayDoneAction, unmarkDayDoneAction } from "@/app/(client)/client/exercicis/actions";
import { formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { WorkoutPlan, WorkoutDay } from "@/lib/data/client-exercises";
import type { ExerciseProgressEntry } from "@/lib/data/exercise-progress";
import { TAP, clsx } from "@/lib/utils";
import { nextWorkoutDayId } from "@/lib/workout-pauta";

const NONE = "none";

/**
 * La pauta del client per dies (0112): pestanyes «Dia 1 · Dia 2 · … · Sense
 * dia», el botó «Dia fet» del dia obert i, a sota, les targetes de sempre amb la
 * pauta i el progrés.
 *
 * S'obre pel dia que TOCA: el següent, en cicle, al darrer que va marcar fet
 * (o el primer, si encara no n'ha marcat cap). Sense cap dia, és la llista de
 * sempre, sense pestanyes.
 */
export function ClientWorkoutPlan({
  plan,
  progressByAssignment,
  today,
}: {
  plan: WorkoutPlan;
  progressByAssignment: Record<string, ExerciseProgressEntry[]>;
  /** Avui a l'hora del centre (YYYY-MM-DD): el «Dia fet» d'avui es pot desfer. */
  today: string;
}) {
  const t = useTranslations("workouts.plan");
  const locale = useLocale() as Locale;
  const { days, exercises, logs } = plan;
  const unassigned = exercises.filter((e) => e.dayId === null);

  const doneTodayIds = new Set(logs.filter((l) => l.doneOn === today && l.dayId).map((l) => l.dayId!));
  const nextId = nextWorkoutDayId(days, logs, today);
  const nextDay = days.find((d) => d.id === nextId) ?? null;

  const [tab, setTab] = useState<string>(nextDay?.id ?? NONE);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (days.length === 0)
    return <AssignedExercises assigned={exercises} progressByAssignment={progressByAssignment} />;

  const current = tab === NONE || days.some((d) => d.id === tab) ? tab : (nextDay?.id ?? NONE);
  const day = days.find((d) => d.id === current) ?? null;
  const list = exercises.filter((e) => (current === NONE ? e.dayId === null : e.dayId === current));
  const label = (d: Pick<WorkoutDay, "number" | "name">) =>
    d.name ? t("dayNamed", { number: d.number, name: d.name }) : t("day", { number: d.number });

  const doneToday = day ? doneTodayIds.has(day.id) : false;
  const lastDone = day ? (logs.find((l) => l.dayId === day.id)?.doneOn ?? null) : null;

  function toggle() {
    if (!day) return;
    setError(null);
    start(async () => {
      const r = doneToday ? await unmarkDayDoneAction(day.id) : await markDayDoneAction(day.id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">{t("cycleHint")}</p>

      <div role="tablist" aria-label={t("tabsAria")} className="flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={current === d.id}
            onClick={() => setTab(d.id)}
            className={clsx(
              `min-h-11 rounded-full border px-4 text-sm font-bold ${TAP}`,
              current === d.id
                ? "border-brand-purple bg-brand-purple text-white"
                : "border-brand-border bg-white text-brand-charcoal hover:border-brand-purple/50",
            )}
          >
            {label(d)}
            {doneTodayIds.has(d.id) && <span aria-hidden> ✓</span>}
            {nextDay?.id === d.id && !doneTodayIds.has(d.id) && (
              <span
                className={clsx(
                  "ml-2 rounded-full px-2 py-0.5 text-[11px] uppercase",
                  current === d.id ? "bg-white/20" : "bg-brand-purple/10 text-brand-purple",
                )}
              >
                {t("next")}
              </span>
            )}
          </button>
        ))}
        {unassigned.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={current === NONE}
            onClick={() => setTab(NONE)}
            className={clsx(
              `min-h-11 rounded-full border px-4 text-sm font-bold ${TAP}`,
              current === NONE
                ? "border-brand-purple bg-brand-purple text-white"
                : "border-brand-border bg-white text-brand-charcoal hover:border-brand-purple/50",
            )}
          >
            {t("noDay")}
          </button>
        )}
      </div>

      {day ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-brand-dark">{label(day)}</p>
            <p className="text-sm text-brand-muted">
              {lastDone ? t("lastDone", { date: formatDate(lastDone, locale) }) : t("neverDone")}
            </p>
          </div>
          {list.length > 0 && (
            <div className="flex items-center gap-3">
              {doneToday && (
                <span className="text-sm font-bold text-success" role="status">
                  ✓ {t("doneToday")}
                </span>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={toggle}
                className={clsx(
                  `min-h-11 rounded-lg px-4 text-sm font-bold tracking-wide uppercase disabled:opacity-50 ${TAP}`,
                  doneToday
                    ? "border border-brand-border bg-white text-brand-muted hover:text-brand-dark"
                    : "w-full bg-brand-purple text-white hover:bg-brand-purple-light sm:w-auto",
                )}
              >
                {pending ? (doneToday ? t("undoing") : t("marking")) : doneToday ? t("undo") : t("markDone")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-brand-muted">{t("noDayHint")}</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          {t("emptyDay")}
        </p>
      ) : (
        <AssignedExercises assigned={list} progressByAssignment={progressByAssignment} />
      )}
    </div>
  );
}
