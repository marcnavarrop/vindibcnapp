"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx, TAP } from "@/lib/utils";
import { formatDayHeading } from "@/lib/labels";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import type { Locale } from "@/lib/i18n/config";
import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";
import {
  calculateSeriesAction,
  confirmSeriesAction,
  type SeriesFormInput,
} from "@/app/(client)/client/reservas/series-actions";
import type { ResolvedOccurrence } from "@/lib/booking-series-core";
import type { ServiceType } from "@/types/database";

/**
 * «Repetir cada setmana», dins de la mateixa fulla on es reserva (C3).
 *
 * Substitueix l'assistent de sèries d'abans (freqüència, data final, nombre de
 * sessions, alternatives, cua i un panell de revisió a part). Per a qui reserva
 * des del mòbil, gairebé sempre la pregunta era una de sola: «la vull cada
 * setmana, quantes setmanes?». Ara és això:
 *
 *   1. Quantes setmanes (4, 8 o 12).
 *   2. «Veure les setmanes»: la llista, setmana a setmana, amb què passarà.
 *      NO escriu res (`calculateSeriesAction`).
 *   3. «Reservar N sessions» (`confirmSeriesAction`).
 *
 * Només es reserven les setmanes amb plaça, a la mateixa hora i amb el mateix
 * professional: sense alternatives ni cua. El servidor ho torna a comprovar tot,
 * inclosa la regla d'amb qui de C1 (`lib/booking-scope.ts`) i que el servei es
 * pugui repetir (`canRepeatInSeries`).
 *
 * La sessió de la qual es parteix, si ja és teva, s'adopta a la sèrie
 * (`ja_reservada`): no es duplica ni gasta cap sessió més.
 */

/** Les opcions de «quantes setmanes». */
export const WEEK_OPTIONS = [4, 8, 12] as const;

export type WeeklySeed = {
  scheduledAt: string;
  trainerId: string;
  serviceType: ServiceType;
};

const BTN = "min-h-11 rounded-lg px-3 py-2 text-sm font-bold";

export function WeeklyRepeat({
  seed,
  subscriptionServiceType = null,
  onBack,
  onDone,
}: {
  seed: WeeklySeed;
  /** De quin servei és la subscripció viva del client, si en té (0072/0086). */
  subscriptionServiceType?: ServiceType | null;
  /** Tornar a la fulla sense repetir. */
  onBack: () => void;
  /** S'ha creat la sèrie: tancar i refrescar. */
  onDone: () => void;
}) {
  const t = useTranslations("reservas.repeat");
  const te = useTranslations("reservas.errors");
  const locale = useLocale() as Locale;
  const [weeks, setWeeks] = useState<number>(WEEK_OPTIONS[0]);
  // La casella d'allargar-se sola només surt si la subscripció viva és
  // d'AQUEST servei; si no, no hi arribaria mai cap sessió (vegeu 0086).
  const subscriptionCovers = subscriptionServiceType === seed.serviceType;
  const [autoExtend, setAutoExtend] = useState(false);
  const [plan, setPlan] = useState<{
    occurrences: ResolvedOccurrence[];
    sessionsRemaining: number;
    skippedForBono: number;
  } | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<ReservaErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const input: SeriesFormInput = {
    firstAt: seed.scheduledAt,
    trainerId: seed.trainerId,
    serviceType: seed.serviceType,
    frequency: "weekly",
    endDate: null,
    occurrenceCount: weeks,
    // Només les setmanes amb plaça: sense alternatives ni cua.
    bookOnlyAvailable: true,
    allowAlternatives: false,
    allowWaitlist: false,
    autoExtend: subscriptionCovers && autoExtend,
  };

  function calculate() {
    setErrorCode(null);
    startTransition(async () => {
      const res = await calculateSeriesAction(input);
      if (res.errorCode) {
        setErrorCode(res.errorCode);
        return;
      }
      setPlan({
        occurrences: res.occurrences ?? [],
        sessionsRemaining: res.sessionsRemaining ?? 0,
        skippedForBono: res.skippedForBono ?? 0,
      });
    });
  }

  function confirm() {
    if (!plan) return;
    setErrorCode(null);
    startTransition(async () => {
      const res = await confirmSeriesAction(input, plan.occurrences);
      if (res.errorCode) {
        setErrorCode(res.errorCode);
        return;
      }
      setDone((res.created ?? 0) + (res.adopted ?? 0));
    });
  }

  if (done !== null)
    return (
      <div className="mt-4 flex flex-col items-center gap-3 text-center" data-testid="repeat-done">
        <AnimatedFeedback type="success" />
        <p className="text-lg font-bold text-brand-dark">{t("doneTitle", { count: done })}</p>
        <p className="text-sm text-brand-muted">{t("doneBody")}</p>
        <button
          type="button"
          onClick={onDone}
          className={`w-full ${BTN} bg-brand-purple text-white active:bg-brand-purple-dark ${TAP}`}
        >
          {t("close")}
        </button>
      </div>
    );

  if (plan) {
    const booked = plan.occurrences.filter((o) => o.status === "confirmada" || o.status === "ja_reservada");
    const newOnes = plan.occurrences.filter((o) => o.status === "confirmada").length;
    return (
      <div className="mt-4 flex flex-col gap-3" data-testid="repeat-plan">
        <ul className="divide-y divide-brand-border rounded-xl border border-brand-border text-sm">
          {plan.occurrences.map((o) => (
            <li key={o.requestedAt} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-bold text-brand-dark first-letter:uppercase">
                {formatDayHeading(o.requestedAt, locale)}
              </span>
              <span
                data-status={o.status}
                className={clsx(
                  "shrink-0 text-xs font-bold",
                  o.status === "confirmada" && "text-green-700",
                  o.status === "ja_reservada" && "text-green-700",
                  o.status === "sense_places" && "text-brand-muted",
                )}
              >
                {o.status === "confirmada"
                  ? t("willBook")
                  : o.status === "ja_reservada"
                    ? t("already")
                    : t("noSpace")}
              </span>
            </li>
          ))}
        </ul>
        {plan.skippedForBono > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {subscriptionCovers
              ? t("bonoLimitSubscription", { skipped: plan.skippedForBono })
              : t("bonoLimit", { skipped: plan.skippedForBono, remaining: plan.sessionsRemaining })}
          </p>
        )}
        {booked.length === 0 && <p className="text-sm text-brand-muted">{t("nothing")}</p>}
        {errorCode && <p className="text-sm text-error">{te(errorCode)}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending || booked.length === 0}
            className={`flex-1 ${BTN} bg-brand-purple text-white active:bg-brand-purple-dark disabled:opacity-60 ${TAP}`}
          >
            {pending ? t("booking") : t("confirm", { count: newOnes })}
          </button>
          <button
            type="button"
            onClick={() => setPlan(null)}
            className={`${BTN} text-brand-muted active:bg-brand-bg ${TAP}`}
          >
            {t("back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-bg p-3" data-testid="repeat-setup">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-brand-charcoal">{t("howMany")}</legend>
        <div className="flex gap-2">
          {WEEK_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === weeks}
              onClick={() => setWeeks(n)}
              className={clsx(
                "min-h-11 flex-1 rounded-lg border text-sm font-bold",
                TAP,
                n === weeks
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-brand-border bg-white text-brand-charcoal active:bg-brand-bg",
              )}
            >
              {t("weeks", { count: n })}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-brand-muted">{t("onlyFree")}</p>
      {subscriptionCovers && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={autoExtend}
            onChange={(e) => setAutoExtend(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-brand-purple"
          />
          <span className="text-sm font-bold text-brand-charcoal">{t("autoExtend")}</span>
        </label>
      )}
      {errorCode && <p className="text-sm text-error">{te(errorCode)}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={calculate}
          disabled={pending}
          className={`flex-1 ${BTN} bg-brand-purple text-white active:bg-brand-purple-dark disabled:opacity-60 ${TAP}`}
        >
          {pending ? t("calculating") : t("see")}
        </button>
        <button type="button" onClick={onBack} className={`${BTN} text-brand-muted active:bg-brand-bg ${TAP}`}>
          {t("back")}
        </button>
      </div>
    </div>
  );
}
