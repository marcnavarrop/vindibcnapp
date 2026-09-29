"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx, TAP } from "@/lib/utils";
import { formatDayHeading, formatTime } from "@/lib/labels";
import { centerDateStr } from "@/lib/center-time";
import { requiresAssignedTrainer } from "@/lib/booking-scope";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import type { Locale } from "@/lib/i18n/config";
import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";
import {
  calculateSeriesAction,
  confirmSeriesAction,
  type SeriesFormInput,
} from "@/app/(client)/client/reservas/series-actions";
import type { ResolvedOccurrence } from "@/lib/booking-series-core";
import type { BookingFrequency, ServiceType } from "@/types/database";

/**
 * Repetir una reserva, dins de la mateixa fulla on es reserva.
 *
 * PER DEFECTE, UNA SOLA PREGUNTA (C3). Per a qui reserva des del mòbil,
 * gairebé sempre la pregunta és «la vull cada setmana, quantes setmanes?»:
 * 4, 8 o 12, i a sota només les setmanes amb plaça, a la mateixa hora i amb el
 * mateix professional.
 *
 * «MÉS OPCIONS», PLEGAT. Hi torna tot el que feia l'assistent d'abans, sense
 * que qui no ho necessita ho vegi:
 *   · Cada quan: cada setmana, cada dues setmanes o cada mes.
 *   · Fins quan: un nombre de sessions o una data final.
 *   · Si un dia no hi ha lloc: saltar-lo, proposar una altra hora o apuntar-se
 *     a la cua.
 *
 * LES ALTERNATIVES RESPECTEN LA REGLA DE C1. Les calcula el servidor
 * (`findAlternative` a `lib/data/booking-series.ts`): primer una altra hora el
 * mateix dia amb el mateix professional i, només si el servei ho permet
 * (`lib/booking-scope.ts`), la mateixa hora amb un altre. En individual i
 * parelles, per tant, mai un altre entrenador. Cada alternativa es proposa a la
 * llista i NO es reserva fins que el client la toca: la que no accepta es
 * queda fora de la sèrie.
 *
 * LA CUA NO ÉS NOMÉS DELS GRUPS. A la llista d'hores la cua només surt als
 * grups plens, perquè una hora individual ocupada ni s'hi ensenya. Però en una
 * sèrie sí que té un cas: una setmana que la franja del teu entrenador l'ha
 * agafada un altre client. Si aquell cancel·la, `promoteFromWaitlist` hi fa
 * entrar el primer de la cua també en individual (`book_individual_slot`,
 * 0084) i li envia el correu. Surt només si el centre té la cua oberta, i el
 * servidor ho torna a mirar.
 *
 * El recorregut és el mateix de C3: preparar → llista (NO escriu res,
 * `calculateSeriesAction`) → reservar (`confirmSeriesAction`). El servidor ho
 * torna a comprovar tot, inclosa la regla d'amb qui i que el servei es pugui
 * repetir (`canRepeatInSeries`). La sessió de la qual es parteix, si ja és
 * teva, s'adopta a la sèrie (`ja_reservada`).
 */

/** Les opcions de «quantes». */
export const WEEK_OPTIONS = [4, 8, 12] as const;

const FREQUENCIES: BookingFrequency[] = ["weekly", "biweekly", "monthly"];

/** Què fer amb un dia sense lloc. */
export type NoSpacePolicy = "skip" | "alternative" | "waitlist";

export type WeeklySeed = {
  scheduledAt: string;
  trainerId: string;
  serviceType: ServiceType;
};

const BTN = "min-h-11 rounded-lg px-3 py-2 text-sm font-bold";

/** YYYY-MM-DD + n dies, sense passar per cap zona horària. */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Un botó d'un grup de «tria'n un», a 44 px. */
function Choice({
  selected,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-testid={testId}
      className={clsx(
        "min-h-11 flex-1 rounded-lg border px-2 text-sm font-bold",
        TAP,
        selected
          ? "border-brand-purple bg-brand-purple text-white"
          : "border-brand-border bg-white text-brand-charcoal active:bg-brand-bg",
      )}
    >
      {children}
    </button>
  );
}

export function WeeklyRepeat({
  seed,
  subscriptionServiceType = null,
  waitlistEnabled = false,
  onBack,
  onDone,
}: {
  seed: WeeklySeed;
  /** De quin servei és la subscripció viva del client, si en té (0072/0086). */
  subscriptionServiceType?: ServiceType | null;
  /** El centre accepta inscripcions noves a la cua. */
  waitlistEnabled?: boolean;
  /** Tornar a la fulla sense repetir. */
  onBack: () => void;
  /** S'ha creat la sèrie: tancar i refrescar. */
  onDone: () => void;
}) {
  const t = useTranslations("reservas.repeat");
  const te = useTranslations("reservas.errors");
  const locale = useLocale() as Locale;
  const firstDay = centerDateStr(new Date(seed.scheduledAt));

  const [count, setCount] = useState<number>(WEEK_OPTIONS[0]);
  const [more, setMore] = useState(false);
  const [frequency, setFrequency] = useState<BookingFrequency>("weekly");
  const [endBy, setEndBy] = useState<"count" | "date">("count");
  const [endDate, setEndDate] = useState(addDays(firstDay, 7 * 8));
  const [noSpace, setNoSpace] = useState<NoSpacePolicy>("skip");
  // La casella d'allargar-se sola només surt si la subscripció viva és
  // d'AQUEST servei; si no, no hi arribaria mai cap sessió (vegeu 0086).
  const subscriptionCovers = subscriptionServiceType === seed.serviceType;
  const [autoExtend, setAutoExtend] = useState(false);
  const [plan, setPlan] = useState<{
    input: SeriesFormInput;
    occurrences: ResolvedOccurrence[];
    sessionsRemaining: number;
    skippedForBono: number;
  } | null>(null);
  // Les alternatives que el client ha acceptat, per `requestedAt`.
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ booked: number; waitlisted: number } | null>(null);
  const [errorCode, setErrorCode] = useState<ReservaErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  // Si el centre tanca la cua amb la fulla oberta, l'opció deixa de valer.
  const policy: NoSpacePolicy =
    noSpace === "waitlist" && !waitlistEnabled ? "skip" : noSpace;
  // «Quantes setmanes?» només quan és el que vol dir: cada setmana i per nombre.
  const weekly = frequency === "weekly";

  function buildInput(): SeriesFormInput {
    return {
      firstAt: seed.scheduledAt,
      trainerId: seed.trainerId,
      serviceType: seed.serviceType,
      frequency,
      endDate: endBy === "date" ? endDate || null : null,
      occurrenceCount: endBy === "count" ? count : null,
      bookOnlyAvailable: policy === "skip",
      allowAlternatives: policy === "alternative",
      allowWaitlist: policy === "waitlist",
      autoExtend: subscriptionCovers && autoExtend,
    };
  }

  function calculate() {
    setErrorCode(null);
    const input = buildInput();
    startTransition(async () => {
      const res = await calculateSeriesAction(input);
      if (res.errorCode) {
        setErrorCode(res.errorCode);
        return;
      }
      setAccepted(new Set());
      setPlan({
        input,
        occurrences: res.occurrences ?? [],
        sessionsRemaining: res.sessionsRemaining ?? 0,
        skippedForBono: res.skippedForBono ?? 0,
      });
    });
  }

  function toggleAlternative(at: string) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(at)) next.delete(at);
      else next.add(at);
      return next;
    });
  }

  function confirm() {
    if (!plan) return;
    setErrorCode(null);
    // Una alternativa acceptada viatja com a 'confirmada' amb la seva hora i el
    // seu professional (`commitSeries` fa servir `alternative`); la que no,
    // es queda com a proposta i el servidor no la toca.
    const decided = plan.occurrences.map((o) =>
      o.status === "alternativa_proposada" && accepted.has(o.requestedAt)
        ? { ...o, status: "confirmada" as const }
        : o,
    );
    startTransition(async () => {
      const res = await confirmSeriesAction(plan.input, decided);
      if (res.errorCode) {
        setErrorCode(res.errorCode);
        return;
      }
      setDone({
        booked: (res.created ?? 0) + (res.adopted ?? 0),
        waitlisted: res.waitlisted ?? 0,
      });
    });
  }

  if (done !== null)
    return (
      <div className="mt-4 flex flex-col items-center gap-3 text-center" data-testid="repeat-done">
        <AnimatedFeedback type="success" />
        <p className="text-lg font-bold text-brand-dark">{t("doneTitle", { count: done.booked })}</p>
        {done.waitlisted > 0 && (
          <p className="text-sm font-bold text-brand-purple">{t("doneWaitlisted", { count: done.waitlisted })}</p>
        )}
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
    const newOnes =
      plan.occurrences.filter((o) => o.status === "confirmada").length +
      plan.occurrences.filter((o) => o.status === "alternativa_proposada" && accepted.has(o.requestedAt)).length;
    const adopted = plan.occurrences.filter((o) => o.status === "ja_reservada").length;
    const queued = plan.occurrences.filter((o) => o.status === "llista_espera").length;
    const pendingAlts = plan.occurrences.filter(
      (o) => o.status === "alternativa_proposada" && !accepted.has(o.requestedAt),
    ).length;
    const anything = newOnes + adopted + queued > 0;
    return (
      <div className="mt-4 flex flex-col gap-3" data-testid="repeat-plan">
        {/* Què s'ha demanat, dit a dalt: la llista es llegeix diferent si és
            cada setmana o cada mes. */}
        <p className="text-sm font-bold text-brand-charcoal" data-testid="repeat-summary">
          {t(`every.${plan.input.frequency}`)} · {formatTime(seed.scheduledAt, locale)}
        </p>
        <ul className="divide-y divide-brand-border rounded-xl border border-brand-border text-sm">
          {plan.occurrences.map((o) => {
            const alt = o.status === "alternativa_proposada" ? o.alternative : undefined;
            const isAccepted = accepted.has(o.requestedAt);
            return (
              <li
                key={o.requestedAt}
                data-status={o.status}
                data-accepted={alt ? String(isAccepted) : undefined}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
              >
                <span className="font-bold text-brand-dark first-letter:uppercase">
                  {formatDayHeading(o.requestedAt, locale)}
                </span>
                {alt ? (
                  <>
                    <span className="text-xs font-bold text-amber-800">
                      {alt.trainerId === seed.trainerId
                        ? t("proposed", { time: formatTime(alt.scheduledAt, locale) })
                        : t("proposedWith", { time: formatTime(alt.scheduledAt, locale), name: alt.trainerName })}
                    </span>
                    <button
                      type="button"
                      aria-pressed={isAccepted}
                      onClick={() => toggleAlternative(o.requestedAt)}
                      className={clsx(
                        "min-h-11 w-full rounded-lg border px-3 text-sm font-bold",
                        TAP,
                        isAccepted
                          ? "border-green-700 bg-green-50 text-green-800"
                          : "border-brand-purple text-brand-purple active:bg-brand-purple/10",
                      )}
                    >
                      {isAccepted ? t("accepted") : t("accept")}
                    </button>
                  </>
                ) : (
                  <span
                    className={clsx(
                      "shrink-0 text-xs font-bold",
                      (o.status === "confirmada" || o.status === "ja_reservada") && "text-green-700",
                      o.status === "llista_espera" && "text-brand-purple",
                      o.status === "sense_places" && "text-brand-muted",
                    )}
                  >
                    {o.status === "confirmada"
                      ? t("willBook")
                      : o.status === "ja_reservada"
                        ? t("already")
                        : o.status === "llista_espera"
                          ? t("queued")
                          : t("noSpace")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {pendingAlts > 0 && <p className="text-xs text-brand-muted">{t("acceptHint")}</p>}
        {plan.skippedForBono > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {subscriptionCovers
              ? t("bonoLimitSubscription", { skipped: plan.skippedForBono })
              : t("bonoLimit", { skipped: plan.skippedForBono, remaining: plan.sessionsRemaining })}
          </p>
        )}
        {!anything && pendingAlts === 0 && <p className="text-sm text-brand-muted">{t("nothing")}</p>}
        {queued > 0 && <p className="text-xs text-brand-muted">{t("queuedHint", { count: queued })}</p>}
        {errorCode && <p className="text-sm text-error">{te(errorCode)}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending || !anything}
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

  const assignedOnly = requiresAssignedTrainer(seed.serviceType);
  const policyHint =
    policy === "skip"
      ? weekly
        ? t("onlyFree")
        : t("onlyFreeDates")
      : policy === "alternative"
        ? assignedOnly
          ? t("altHintAssigned")
          : t("altHintAny")
        : t("waitHint");

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-bg p-3" data-testid="repeat-setup">
      {endBy === "count" ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-brand-charcoal">
            {weekly ? t("howMany") : t("howManySessions")}
          </legend>
          <div className="flex gap-2">
            {WEEK_OPTIONS.map((n) => (
              <Choice key={n} selected={n === count} onClick={() => setCount(n)}>
                {weekly ? t("weeks", { count: n }) : t("sessions", { count: n })}
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-brand-charcoal">{t("untilWhen")}</span>
          <input
            type="date"
            data-testid="repeat-end-date"
            value={endDate}
            min={firstDay}
            max={addDays(firstDay, 365)}
            onChange={(e) => setEndDate(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 text-sm text-brand-dark"
          />
        </label>
      )}
      <p className="text-xs text-brand-muted" data-testid="repeat-hint">{policyHint}</p>
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

      {/* Plegat: la immensa majoria de sèries són «cada setmana, N setmanes». */}
      <div className="border-t border-brand-border pt-1">
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          data-testid="repeat-more"
          className={`flex min-h-11 w-full items-center justify-between text-sm font-bold text-brand-purple active:opacity-70 ${TAP}`}
        >
          {t("more")}
          <span aria-hidden>{more ? "−" : "+"}</span>
        </button>
        {more && (
          <div className="flex flex-col gap-3 pb-1" data-testid="repeat-options">
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-brand-muted uppercase">{t("howOften")}</legend>
              <div className="flex gap-2">
                {FREQUENCIES.map((f) => (
                  <Choice key={f} selected={f === frequency} onClick={() => setFrequency(f)} testId={`freq-${f}`}>
                    {t(`freq.${f}`)}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-brand-muted uppercase">{t("endBy")}</legend>
              <div className="flex gap-2">
                <Choice selected={endBy === "count"} onClick={() => setEndBy("count")} testId="end-count">
                  {t("endCount")}
                </Choice>
                <Choice selected={endBy === "date"} onClick={() => setEndBy("date")} testId="end-date">
                  {t("endDate")}
                </Choice>
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-brand-muted uppercase">{t("ifNoSpace")}</legend>
              <div className="flex flex-col gap-2">
                <Choice selected={policy === "skip"} onClick={() => setNoSpace("skip")} testId="nospace-skip">
                  {t("policy.skip")}
                </Choice>
                <Choice selected={policy === "alternative"} onClick={() => setNoSpace("alternative")} testId="nospace-alternative">
                  {t("policy.alternative")}
                </Choice>
                {waitlistEnabled && (
                  <Choice selected={policy === "waitlist"} onClick={() => setNoSpace("waitlist")} testId="nospace-waitlist">
                    {t("policy.waitlist")}
                  </Choice>
                )}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {errorCode && <p className="text-sm text-error">{te(errorCode)}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={calculate}
          disabled={pending || (endBy === "date" && !endDate)}
          className={`flex-1 ${BTN} bg-brand-purple text-white active:bg-brand-purple-dark disabled:opacity-60 ${TAP}`}
        >
          {pending ? t("calculating") : weekly ? t("see") : t("seeDates")}
        </button>
        <button type="button" onClick={onBack} className={`${BTN} text-brand-muted active:bg-brand-bg ${TAP}`}>
          {t("back")}
        </button>
      </div>
    </div>
  );
}
