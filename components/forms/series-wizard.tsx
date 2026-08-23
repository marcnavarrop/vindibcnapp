"use client";

import { useState, useTransition } from "react";
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
 * Assistent de "reserva en bucle": tria la sessió → repetició → confirmar.
 *
 * El pas 2 calcula al servidor i ensenya el resultat SENSE reservar res. Fins
 * que no es prem "Confirmar sèrie" no hi ha cap fila nova, de manera que es pot
 * anar endavant i enrere, canviar la freqüència o acceptar alternatives tantes
 * vegades com calgui sense deixar mitja sèrie feta.
 */

export type SeriesSeed = {
  scheduledAt: string;
  trainerId: string;
  trainerName: string;
  serviceType: ServiceType;
  /** Places lliures si és un grup, per ensenyar-ho al pas 1. */
  groupFree?: { free: number; capacity: number } | null;
};

const FREQUENCIES: BookingFrequency[] = ["weekly", "biweekly", "monthly"];

export function SeriesWizard({
  seed,
  remainingSessions,
  onClose,
  onDone,
}: {
  seed: SeriesSeed;
  /**
   * Sessions que queden al bo d'aquest servei, per saber d'un cop d'ull si
   * arribaran per a tota la sèrie sense haver d'anar a mirar-ho a "Bons".
   */
  remainingSessions?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [frequency, setFrequency] = useState<BookingFrequency>("weekly");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [alternatives, setAlternatives] = useState(true);
  const [waitlist, setWaitlist] = useState(false);

  const [occurrences, setOccurrences] = useState<ResolvedOccurrence[] | null>(null);
  const [bono, setBono] = useState<{ remaining: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    created: number;
    adopted: number;
    waitlisted: number;
    failed: number;
  } | null>(null);
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
        setOccurrences(null);
        setBono(null);
        return;
      }
      setOccurrences(res.occurrences ?? []);
      setBono({
        remaining: res.bonoRemaining ?? 0,
        skipped: res.skippedForBono ?? 0,
      });
    });
  }

  /** Acceptar una alternativa la converteix en confirmada per al commit. */
  function acceptAlternative(index: number) {
    setOccurrences((prev) =>
      prev
        ? prev.map((o, i) =>
            i === index ? { ...o, status: "confirmada" as const } : o,
          )
        : prev,
    );
  }

  function confirm() {
    if (!occurrences) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmSeriesAction(input, occurrences);
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

  const stats = occurrences ? summarize(occurrences) : null;

  if (done)
    return (
      <Panel onClose={onDone} title="Sèrie creada">
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
      </Panel>
    );

  return (
    <Panel onClose={onClose} title="Nova reserva en bucle">
      {/* El pas es dedueix de l'estat, no es desa a part: la sessió ja està
          triada (1), calcular la disponibilitat porta al 2 i tenir el resultat
          a la vista és ja el 3. Un `step` propi només podria desincronitzar-se
          del que es veu. */}
      <Steps current={occurrences ? 3 : 2} />

      {/* ── 1. La sessió de partida ── */}
      <Section n={1} title="Sessió seleccionada">
        <div className="rounded-xl border border-brand-border bg-brand-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold text-brand-dark">
                {SERVICE_LABELS[seed.serviceType]}
              </p>
              <p className="text-sm text-brand-muted">{seed.trainerName}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-brand-dark capitalize">
                {formatDayHeading(seed.scheduledAt)}
              </p>
              <p className="text-brand-muted">{formatTime(seed.scheduledAt)}</p>
            </div>
          </div>
          {seed.groupFree && (
            <p className="mt-2 text-sm font-bold text-success">
              Places disponibles: {seed.groupFree.free} de {seed.groupFree.capacity}
            </p>
          )}
          {/* El sostre de la sèrie, dit abans de demanar-la: aquestes són les
              sessions que hi ha per repartir, i és el que decideix fins on
              podrà arribar. */}
          {remainingSessions !== undefined && (
            <p
              className={clsx(
                "mt-3 border-t border-brand-border pt-3 text-sm font-bold",
                remainingSessions === 0 ? "text-error" : "text-brand-purple",
              )}
            >
              {remainingSessions === 0
                ? `No et queden sessions al bo ${deOf(SERVICE_LABELS[seed.serviceType])}.`
                : `Et ${remainingSessions === 1 ? "queda" : "queden"} ${sessionsLabel(remainingSessions)} al teu bo ${deOf(SERVICE_LABELS[seed.serviceType])}.`}
            </p>
          )}
        </div>
      </Section>

      {/* ── 2. Repetició ── */}
      <Section n={2} title="Repetició i disponibilitat">
        <div className="flex flex-col gap-4">
          <div>
            <Label>Repeteix cada</Label>
            <div className="mt-1.5 inline-flex flex-wrap gap-1 rounded-lg border border-brand-border bg-white p-0.5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFrequency(f);
                    setOccurrences(null);
                  }}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="endDate">Fins quan?</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setOccurrences(null);
                }}
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
                onChange={(e) => {
                  setCount(e.target.value);
                  setOccurrences(null);
                }}
                placeholder="Ex.: 10"
                className={INPUT}
              />
            </div>
          </div>
          {/* Es pot dir amb data, amb nombre o amb tots dos: si es donen els
              dos, la sèrie s'atura al primer que es compleixi. */}
          <p className="-mt-2 text-xs text-brand-muted">
            Pots omplir-ne un o tots dos. Amb tots dos, la sèrie s&apos;atura amb
            el primer que arribi.
          </p>

          <div className="flex flex-col gap-2 rounded-xl border border-brand-border p-4">
            <p className="text-sm font-bold text-brand-dark">
              Gestiona els casos sense disponibilitat
            </p>
            <Check
              checked={onlyAvailable}
              onChange={(v) => {
                setOnlyAvailable(v);
                setOccurrences(null);
              }}
              title="Reservar només les disponibles"
              desc="Només es confirmaran les sessions amb plaça. Té prioritat sobre les altres dues."
            />
            <Check
              checked={alternatives}
              disabled={onlyAvailable}
              onChange={(v) => {
                setAlternatives(v);
                setOccurrences(null);
              }}
              title="Proposar alternatives automàtiques"
              desc="Et suggerim la millor alternativa possible i tu decideixes si l'acceptes."
            />
            <Check
              checked={waitlist}
              disabled={onlyAvailable}
              onChange={(v) => {
                setWaitlist(v);
                setOccurrences(null);
              }}
              title="Afegir a la llista d'espera si no hi ha plaça"
              desc="T'apuntem a la cua i, si algú cancel·la, la plaça és teva."
            />
          </div>

          <button
            type="button"
            onClick={calculate}
            disabled={pending}
            className="self-start rounded-lg border-2 border-brand-purple px-4 py-2 text-sm font-bold text-brand-purple hover:bg-brand-purple/5 disabled:opacity-60"
          >
            {pending ? "Calculant…" : "Comprovar disponibilitat"}
          </button>

          {error && <p className="text-sm text-error">{error}</p>}

          {occurrences && (
            <OccurrenceList
              occurrences={occurrences}
              onAccept={acceptAlternative}
            />
          )}
        </div>
      </Section>

      {/* ── 3. Resum i confirmació ── */}
      {stats && (
        <Section n={3} title="Revisar i confirmar">
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
          {/* Quan el bo s'acaba, la sèrie es queda curta. Abans això passava
              en silenci: la llista s'acabava i prou. */}
          {bono && bono.skipped > 0 && (
            <p className="mt-2 text-xs font-bold text-brand-orange">
              El teu bo només tenia {sessionsLabel(bono.remaining)}: no s&apos;han
              pogut generar {bono.skipped}{" "}
              {bono.skipped === 1 ? "ocurrència més" : "ocurrències més"}.
            </p>
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
          {stats.alternatives > 0 && (
            <p className="mt-2 text-xs text-brand-orange">
              Tens {stats.alternatives} alternatives sense acceptar: si no les
              acceptes, aquelles sessions no es reservaran.
            </p>
          )}
        </Section>
      )}
    </Panel>
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

function Panel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    /**
     * El panell es desplaça sol.
     *
     * Abans creixia tant com calgués i, per arribar al final de la llista
     * d'ocurrències o al botó de confirmar, s'havia de desplaçar tota la
     * pàgina, calendari inclòs. Ara té l'alçada acotada a la finestra i el seu
     * propi desplaçament; `overscroll-contain` evita que en arribar al final
     * la roda continuï movent el calendari de sota.
     *
     * Només a partir de `xl`, que és on el panell viu al costat del calendari
     * i es queda enganxat. Per sota va apilat i és millor que flueixi amb la
     * pàgina: acotar-lo allà seria una caixeta amb scroll dins d'una altra.
     */
    <aside className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-white p-5 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:overscroll-contain">
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

function Steps({ current }: { current: number }) {
  const labels = ["Tria la sessió", "Repetició i disponibilitat", "Revisar i confirmar"];
  return (
    <ol className="flex items-start gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n <= current;
        return (
          <li key={l} className="flex flex-1 flex-col items-center gap-1 text-center">
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                active
                  ? "bg-brand-purple text-white"
                  : "border border-brand-border text-brand-muted",
              )}
            >
              {n}
            </span>
            <span
              className={clsx(
                "text-[11px] leading-tight",
                active ? "font-bold text-brand-dark" : "text-brand-muted",
              )}
            >
              {l}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-brand-dark">
        {n}. {title}
      </h3>
      {children}
    </section>
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
      <ul className="max-h-72 divide-y divide-brand-border overflow-y-auto rounded-xl border border-brand-border">
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
