"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { formatDayHeading, formatTime } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";

/**
 * El to visual de cada estat. El TEXT viu al diccionari (`wizard.status`); això
 * només diu de quin color es pinta, que no depèn de l'idioma.
 */
const OCCURRENCE_TONE: Record<string, "success" | "warn" | "info" | "danger"> = {
  confirmada: "success",
  ja_reservada: "success",
  alternativa_proposada: "warn",
  llista_espera: "info",
  sense_places: "danger",
};
import { summarize, type ResolvedOccurrence } from "@/lib/booking-series-core";
import {
  calculateSeriesAction,
  confirmSeriesAction,
  type SeriesFormInput,
} from "@/app/(client)/client/reservas/series-actions";
import type { BookingFrequency, ServiceType } from "@/types/database";

/**
 * Reserva en bucle, en dues peces.
 *
 * `RecurrenceFields` viu DINS del diàleg de reserva: decidir "la vull cada
 * setmana" és la mateixa decisió que "la vull", i separar-ho en dues
 * superfícies feia que es poguessin veure alhora un diàleg parlant d'un dia i
 * un panell parlant d'un altre. Ara es plega sota una casella al mateix lloc.
 *
 * `SeriesReview` és el que sí que necessita espai: la llista d'ocurrències, que
 * pot ser llarga i es llegeix amb calma. No tapa el calendari —serveix de
 * context per veure on cauen les sessions— i a mòbil puja com una fulla.
 *
 * El càlcul no escriu res: fins que no es prem "Confirmar sèrie" a la base no
 * hi ha cap fila.
 */

export type SeriesSeed = {
  scheduledAt: string;
  trainerId: string;
  trainerName: string;
  serviceType: ServiceType;
};

/** El que passa del diàleg al panell de revisió. */
export type SeriesReviewState = {
  seed: SeriesSeed;
  input: SeriesFormInput;
  occurrences: ResolvedOccurrence[];
  bonoRemaining: number;
  skippedForBono: number;
};

const FREQUENCIES: BookingFrequency[] = ["weekly", "biweekly", "monthly"];

// ─── Els camps, dins del diàleg ─────────────────────────────────────────────

/**
 * Freqüència, final i opcions, amb el botó primari.
 *
 * El botó és ÚNIC a propòsit: quan la casella està marcada, el diàleg amaga el
 * seu "Reservar" i aquí només hi ha "Veure les sessions". Dos botons primaris
 * que fan coses de mida molt diferent —una reserva o deu— és exactament on la
 * gent es descuida de mirar.
 */
export function RecurrenceFields({
  seed,
  remainingSessions,
  waitlistEnabled = false,
  onReady,
  secondaryAction,
}: {
  seed: SeriesSeed;
  /** Sessions del bo d'aquest servei, per saber si arribaran. */
  remainingSessions?: number;
  /**
   * El centre accepta inscripcions noves a la cua. Si no, l'opció ni surt;
   * el servidor també la ignora, que és el que de debò la tanca.
   */
  waitlistEnabled?: boolean;
  onReady: (review: SeriesReviewState) => void;
  /** El botó de tancar del diàleg amfitrió, al costat del primari. */
  secondaryAction?: React.ReactNode;
}) {
  const t = useTranslations("wizard");
  const tf = useTranslations("wizard.frequency");
  const te = useTranslations("reservas.errors");
  const [calcError, setCalcError] = useState<ReservaErrorCode | null>(null);
  const [frequency, setFrequency] = useState<BookingFrequency>("weekly");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [alternatives, setAlternatives] = useState(true);
  const [waitlist, setWaitlist] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [pending, startTransition] = useTransition();

  const input: SeriesFormInput = {
    firstAt: seed.scheduledAt,
    trainerId: seed.trainerId,
    serviceType: seed.serviceType,
    frequency,
    endDate: endDate || null,
    occurrenceCount: count ? Number(count) : null,
    bookOnlyAvailable: onlyAvailable,
    allowAlternatives: alternatives,
    allowWaitlist: waitlist,
  };

  function calculate() {
    setCalcError(null);
    startTransition(async () => {
      const res = await calculateSeriesAction(input);
      if (res.errorCode) {
        setCalcError(res.errorCode);
        return;
      }
      onReady({
        seed,
        input,
        occurrences: res.occurrences ?? [],
        bonoRemaining: res.bonoRemaining ?? 0,
        skippedForBono: res.skippedForBono ?? 0,
      });
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-bg p-3">
      <div>
        <Label>{t("repeatEvery")}</Label>
        <div className="mt-1.5 inline-flex flex-wrap gap-1 rounded-lg border border-brand-border bg-white p-0.5">
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
                frequency === f
                  ? "bg-brand-purple text-white"
                  : "text-brand-muted hover:text-brand-dark",
              )}
            >
              {tf(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="endDate">{t("untilWhen")}</Label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <Label htmlFor="count">{t("orHowMany")}</Label>
          <input
            id="count"
            type="number"
            min={1}
            max={52}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder={t("countPlaceholder")}
            className={INPUT}
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-brand-muted">
        {t("limitsHint")}
      </p>

      {/* El sostre de la sèrie, dit abans de demanar-la. */}
      {remainingSessions !== undefined && (
        <p
          className={clsx(
            "text-sm font-bold",
            remainingSessions === 0 ? "text-error" : "text-brand-purple",
          )}
        >
          {remainingSessions === 0
            ? t("noneLeft")
            : t("left", { count: remainingSessions })}
        </p>
      )}

      {/* Plegades: la immensa majoria de sèries es fan amb el que ve per
          defecte, i desplegades feien el diàleg massa alt per a una pantalla
          de portàtil. */}
      <div className="border-t border-brand-border pt-2">
        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          aria-expanded={showOptions}
          className="flex w-full items-center justify-between text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark"
        >
          {t("ifNoSpace")}
          <span aria-hidden>{showOptions ? "−" : "+"}</span>
        </button>
        {showOptions && (
          <div className="mt-2 flex flex-col gap-2">
            <Check
              checked={onlyAvailable}
              onChange={setOnlyAvailable}
              title={t("onlyAvailable")}
              desc={t("onlyAvailableDesc")}
            />
            <Check
              checked={alternatives}
              disabled={onlyAvailable}
              onChange={setAlternatives}
              title={t("proposeAlt")}
              desc={t("proposeAltDesc")}
            />
            {waitlistEnabled && (
              <Check
                checked={waitlist}
                disabled={onlyAvailable}
                onChange={setWaitlist}
                title={t("addWaitlist")}
                desc={t("addWaitlistDesc")}
              />
            )}
          </div>
        )}
      </div>

      {calcError && <p className="text-sm text-error">{te(calcError)}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={calculate}
          disabled={pending}
          className="flex-1 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-60"
        >
          {pending ? t("calculating") : t("seeSessions")}
        </button>
        {secondaryAction}
      </div>
    </div>
  );
}

// ─── El panell de revisió ───────────────────────────────────────────────────

/**
 * La llista d'ocurrències i la confirmació.
 *
 * Sense vel: el calendari de sota és context útil —es veu on cauen les
 * sessions— i tapar-lo no protegeix res. A mòbil, on una columna al costat no
 * hi cap, puja com una fulla que ocupa la pantalla; abans es dibuixava sota
 * tot el calendari, a més de mil píxels, i semblava que no s'hagués obert res.
 */
export function SeriesReview({
  review,
  onClose,
  onDone,
}: {
  review: SeriesReviewState;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("wizard");
  const tf = useTranslations("wizard.frequency");
  const te = useTranslations("reservas.errors");
  const tr = useTranslations("reservas");
  const tl = useTranslations("labels.service");
  const locale = useLocale() as Locale;
  const [occurrences, setOccurrences] = useState(review.occurrences);
  const [errorCode, setErrorCode] = useState<ReservaErrorCode | null>(null);
  const [done, setDone] = useState<{
    created: number;
    adopted: number;
    waitlisted: number;
    failed: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Acceptar una alternativa la converteix en confirmada per al commit. */
  function acceptAlternative(index: number) {
    setOccurrences((prev) =>
      prev.map((o, i) =>
        i === index ? { ...o, status: "confirmada" as const } : o,
      ),
    );
  }

  function confirm() {
    setErrorCode(null);
    startTransition(async () => {
      const res = await confirmSeriesAction(review.input, occurrences);
      if (res.errorCode) {
        setErrorCode(res.errorCode);
        return;
      }
      setDone({
        created: res.created ?? 0,
        adopted: res.adopted ?? 0,
        waitlisted: res.waitlisted ?? 0,
        failed: res.failed ?? 0,
      });
    });
  }

  const stats = summarize(occurrences);

  if (done)
    return (
      <Sheet onClose={onDone} title={t("createdTitle")} ariaClose={t("closeAria")}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AnimatedFeedback type="success" />
          <p className="text-lg font-bold text-success">{t("allBooked")}</p>
          <p className="text-sm text-brand-muted">
            {t("createdCount", { count: done.created })}
            {done.adopted > 0 &&
              ` · ${
                done.adopted === 1
                  ? t("adoptedOne")
                  : t("adoptedMany", { count: done.adopted })
              }`}
            {done.waitlisted > 0 &&
              ` · ${t("waitlistedCount", { count: done.waitlisted })}`}
            {done.failed > 0 && ` · ${t("failedCount", { count: done.failed })}`}
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
          >
            {t("seeMyBookings")}
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet onClose={onClose} title={t("reviewTitle")} ariaClose={t("closeAria")}>
      <div className="rounded-xl border border-brand-border bg-brand-bg p-3 text-sm">
        <p className="font-bold text-brand-dark">
          {tl(review.seed.serviceType)} {t("with")} {review.seed.trainerName}
        </p>
        <p className="text-brand-muted first-letter:capitalize">
          {t("everyFromFull", {
            frequency: tf(review.input.frequency).toLowerCase(),
            day: formatDayHeading(review.seed.scheduledAt, locale),
            time: formatTime(review.seed.scheduledAt, locale),
          })}
        </p>
      </div>

      <OccurrenceList occurrences={occurrences} onAccept={acceptAlternative} />

      <div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-brand-border bg-brand-bg p-4 text-center sm:grid-cols-4">
          <Stat n={stats.total} label={t("statTotal")} />
          <Stat n={stats.confirmed} label={t("statConfirmed")} tone="text-success" />
          <Stat
            n={stats.alternatives}
            label={t("statAlternatives")}
            tone="text-brand-orange"
          />
          <Stat n={stats.waitlisted} label={t("statWaitlisted")} tone="text-brand-purple" />
        </div>
        {stats.alreadyBooked > 0 && (
          <p className="mt-2 text-xs text-success">
            {stats.alreadyBooked === 1
              ? t("alreadyOne")
              : t("alreadyMany", { count: stats.alreadyBooked })}
          </p>
        )}
        {stats.unavailable > 0 && (
          <p className="mt-2 text-xs text-brand-muted">
            {t("unavailable", { count: stats.unavailable })}
          </p>
        )}
        {review.skippedForBono > 0 && (
          <p className="mt-2 text-xs font-bold text-brand-orange">
            {t("bonoLimit", {
              remaining: review.bonoRemaining,
              skipped: review.skippedForBono,
            })}
          </p>
        )}
        {stats.alternatives > 0 && (
          <p className="mt-2 text-xs text-brand-orange">
            {t("pendingAlternatives", { count: stats.alternatives })}
          </p>
        )}
        {errorCode && (
          <p className="mt-2 text-sm text-error">{te(errorCode)}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={
              pending ||
              stats.confirmed + stats.waitlisted + stats.alreadyBooked === 0
            }
            className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light disabled:opacity-60"
          >
            {pending ? t("creating") : t("confirmSeries")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-bold text-brand-muted hover:text-brand-dark"
          >
            {tr("cancel")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Peces ──────────────────────────────────────────────────────────────────

const INPUT =
  "mt-1.5 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none";

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-bold tracking-wide text-brand-muted uppercase"
    >
      {children}
    </label>
  );
}

/**
 * El contenidor del pas de revisió: fulla a mòbil, columna a l'escriptori.
 *
 * A mòbil és `fixed` i ocupa la pantalla (no hi ha lloc per a una columna al
 * costat), amb una petita entrada des de baix perquè s'entengui d'on surt. A
 * partir de `xl` torna a ser una columna normal dins de la graella, amb la
 * seva alçada acotada i el seu propi desplaçament: `overscroll-contain` evita
 * que en arribar al final la roda es posi a moure el calendari.
 */
function Sheet({
  title,
  children,
  onClose,
  ariaClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Etiqueta del botó de tancar, ja traduïda. */
  ariaClose?: string;
}) {
  // Un tic perquè el navegador pinti la posició inicial abans d'animar: sense
  // això la fulla ja hi és quan es pinta i no s'entén d'on ha sortit.
  const [up, setUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUp(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <aside
      style={{
        transform: up ? "translateY(0)" : "translateY(1.5rem)",
        opacity: up ? 1 : 0,
        transition: "transform 0.25s ease-out, opacity 0.2s ease-out",
      }}
      className={clsx(
        "fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col gap-5 overflow-y-auto overscroll-contain rounded-t-2xl border border-brand-border bg-white p-5 shadow-2xl",
        "xl:static xl:z-auto xl:max-h-[calc(100vh-2rem)] xl:rounded-2xl xl:shadow-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-brand-dark">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={ariaClose ?? "Tancar"}
          className="rounded-md p-1 text-brand-muted hover:bg-brand-bg hover:text-brand-dark"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
      </div>
      {children}
    </aside>
  );
}

function Check({
  checked,
  onChange,
  title,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-start gap-2.5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
      />
      <span className="text-sm">
        <span className="block font-bold text-brand-charcoal">{title}</span>
        <span className="block text-xs text-brand-muted">{desc}</span>
      </span>
    </label>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div>
      <p className={clsx("text-2xl font-bold", tone ?? "text-brand-dark")}>{n}</p>
      <p className="text-[11px] text-brand-muted">{label}</p>
    </div>
  );
}

function OccurrenceList({
  occurrences,
  onAccept,
}: {
  occurrences: ResolvedOccurrence[];
  onAccept: (index: number) => void;
}) {
  const t = useTranslations("wizard");
  const ts = useTranslations("wizard.status");
  const locale = useLocale() as Locale;

  if (occurrences.length === 0)
    return (
      <p className="rounded-xl border border-brand-border p-4 text-sm text-brand-muted">
        {t("noOccurrences")}
      </p>
    );

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold tracking-wide text-brand-muted uppercase">
        {t("availabilityCheck")}
      </p>
      <ul className="divide-y divide-brand-border rounded-xl border border-brand-border">
        {occurrences.map((o, i) => {
          const tone = OCCURRENCE_TONE[o.status] ?? "info";
          return (
            <li key={o.requestedAt} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-xs text-brand-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-brand-dark capitalize">
                  {formatDayHeading(o.requestedAt, locale)}
                </span>
                <span className="block text-xs text-brand-muted">
                  {formatTime(o.requestedAt, locale)}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </span>
              <Badge tone={tone}>{ts(o.status)}</Badge>
              {o.alternative && o.status === "alternativa_proposada" && (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-brand-muted">
                    {formatTime(o.alternative.scheduledAt, locale)} {t("with")}{" "}
                    {o.alternative.trainerName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAccept(i)}
                    className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-brand-purple hover:border-brand-purple"
                  >
                    {t("accept")}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
