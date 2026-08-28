"use client";

import { useEffect, useState, useTransition } from "react";
import { clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import {
  SERVICE_LABELS,
  FREQUENCY_LABELS,
  OCCURRENCE_LABELS,
  formatDayHeading,
  formatTime,
  sessionsLabel,
  deOf,
} from "@/lib/labels";
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
  const [frequency, setFrequency] = useState<BookingFrequency>("weekly");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [alternatives, setAlternatives] = useState(true);
  const [waitlist, setWaitlist] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    startTransition(async () => {
      const res = await calculateSeriesAction(input);
      if (res.error) {
        setError(res.error);
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
        <Label>Repeteix cada</Label>
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
              {FREQUENCY_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="endDate">Fins quan?</Label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <Label htmlFor="count">O quantes sessions</Label>
          <input
            id="count"
            type="number"
            min={1}
            max={52}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Ex.: 10"
            className={INPUT}
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-brand-muted">
        Pots omplir-ne un o tots dos. Amb tots dos, la sèrie s&apos;atura amb el
        primer que arribi.
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
            ? `No et queden sessions al bo ${deOf(SERVICE_LABELS[seed.serviceType])}.`
            : `Et ${remainingSessions === 1 ? "queda" : "queden"} ${sessionsLabel(remainingSessions)} al teu bo ${deOf(SERVICE_LABELS[seed.serviceType])}.`}
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
          Si no hi ha plaça…
          <span aria-hidden>{showOptions ? "−" : "+"}</span>
        </button>
        {showOptions && (
          <div className="mt-2 flex flex-col gap-2">
            <Check
              checked={onlyAvailable}
              onChange={setOnlyAvailable}
              title="Reservar només les disponibles"
              desc="Només es confirmaran les sessions amb plaça. Té prioritat sobre les altres dues."
            />
            <Check
              checked={alternatives}
              disabled={onlyAvailable}
              onChange={setAlternatives}
              title="Proposar alternatives automàtiques"
              desc="Et suggerim la millor alternativa possible i tu decideixes si l'acceptes."
            />
            {waitlistEnabled && (
              <Check
                checked={waitlist}
                disabled={onlyAvailable}
                onChange={setWaitlist}
                title="Afegir a la llista d'espera si no hi ha plaça"
                desc="T'apuntem a la cua i, si algú cancel·la, la plaça és teva."
              />
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={calculate}
          disabled={pending}
          className="flex-1 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-60"
        >
          {pending ? "Calculant…" : "Veure les sessions"}
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
  const [occurrences, setOccurrences] = useState(review.occurrences);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    startTransition(async () => {
      const res = await confirmSeriesAction(review.input, occurrences);
      if (res.error) {
        setError(res.error);
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
      <Sheet onClose={onDone} title="Sèrie creada">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AnimatedFeedback type="success" />
          <p className="text-lg font-bold text-success">Ja ho tens tot reservat</p>
          <p className="text-sm text-brand-muted">
            {sessionsLabel(done.created)} confirmades
            {done.adopted > 0 &&
              ` · ${done.adopted === 1 ? "la que ja tenies" : `${done.adopted} que ja tenies`} afegida${done.adopted === 1 ? "" : "es"} a la sèrie`}
            {done.waitlisted > 0 && ` · ${done.waitlisted} a la llista d'espera`}
            {done.failed > 0 && ` · ${done.failed} que no s'han pogut crear`}
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
          >
            Veure les meves reserves
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet onClose={onClose} title="Revisa la sèrie">
      <div className="rounded-xl border border-brand-border bg-brand-bg p-3 text-sm">
        <p className="font-bold text-brand-dark">
          {SERVICE_LABELS[review.seed.serviceType]} amb {review.seed.trainerName}
        </p>
        <p className="text-brand-muted">
          Cada {FREQUENCY_LABELS[review.input.frequency].toLowerCase()}, a partir
          del{" "}
          <span className="capitalize">
            {formatDayHeading(review.seed.scheduledAt)}
          </span>{" "}
          a les {formatTime(review.seed.scheduledAt)}
        </p>
      </div>

      <OccurrenceList occurrences={occurrences} onAccept={acceptAlternative} />

      <div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-brand-border bg-brand-bg p-4 text-center sm:grid-cols-4">
          <Stat n={stats.total} label="sessions totals" />
          <Stat n={stats.confirmed} label="confirmades" tone="text-success" />
          <Stat
            n={stats.alternatives}
            label="alternatives"
            tone="text-brand-orange"
          />
          <Stat n={stats.waitlisted} label="en espera" tone="text-brand-purple" />
        </div>
        {stats.alreadyBooked > 0 && (
          <p className="mt-2 text-xs text-success">
            {stats.alreadyBooked === 1
              ? "1 ja la tenies reservada: s'afegirà a la sèrie i es cancel·larà amb ella."
              : `${stats.alreadyBooked} ja les tenies reservades: s'afegiran a la sèrie i es cancel·laran amb ella.`}
          </p>
        )}
        {stats.unavailable > 0 && (
          <p className="mt-2 text-xs text-brand-muted">
            {stats.unavailable} sense plaça: aquestes no es reservaran.
          </p>
        )}
        {review.skippedForBono > 0 && (
          <p className="mt-2 text-xs font-bold text-brand-orange">
            El teu bo només tenia {sessionsLabel(review.bonoRemaining)}: no
            s&apos;han pogut generar {review.skippedForBono}{" "}
            {review.skippedForBono === 1 ? "ocurrència més" : "ocurrències més"}.
          </p>
        )}
        {stats.alternatives > 0 && (
          <p className="mt-2 text-xs text-brand-orange">
            Tens {stats.alternatives} alternatives sense acceptar: si no les
            acceptes, aquelles sessions no es reservaran.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-error">{error}</p>}

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
            {pending ? "Creant la sèrie…" : "Confirmar sèrie"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-bold text-brand-muted hover:text-brand-dark"
          >
            Cancel·lar
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
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
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
          aria-label="Tancar"
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
  if (occurrences.length === 0)
    return (
      <p className="rounded-xl border border-brand-border p-4 text-sm text-brand-muted">
        Amb aquests límits no surt cap sessió. Revisa la data o el nombre de
        repeticions.
      </p>
    );

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold tracking-wide text-brand-muted uppercase">
        Comprovació de disponibilitat
      </p>
      <ul className="divide-y divide-brand-border rounded-xl border border-brand-border">
        {occurrences.map((o, i) => {
          const meta = OCCURRENCE_LABELS[o.status];
          return (
            <li key={o.requestedAt} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-xs text-brand-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-brand-dark capitalize">
                  {formatDayHeading(o.requestedAt)}
                </span>
                <span className="block text-xs text-brand-muted">
                  {formatTime(o.requestedAt)}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </span>
              <Badge tone={meta.tone === "info" ? "info" : meta.tone}>
                {meta.label}
              </Badge>
              {o.alternative && o.status === "alternativa_proposada" && (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-brand-muted">
                    {formatTime(o.alternative.scheduledAt)} amb{" "}
                    {o.alternative.trainerName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAccept(i)}
                    className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-brand-purple hover:border-brand-purple"
                  >
                    Accepta
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
