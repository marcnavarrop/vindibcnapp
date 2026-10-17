import { CHART, chartGeometry, formatDiff, formatValue, trendOf, withUnit, type BetterWhen } from "@/lib/client-tests";
import { formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import { clsx } from "@/lib/utils";

/**
 * Les peces que veuen igual l'equip (fitxa, en català) i el client (la seva
 * àrea, en ca/es/en): la darrera marca amb la diferència i la gràfica. Sense
 * textos propis: qui les fa servir hi passa els rètols ja traduïts.
 */

type Entry = { measuredOn: string; value: number };

const TONE: Record<"good" | "bad" | "same", string> = {
  good: "bg-success-bg text-success",
  bad: "bg-error-bg text-error",
  same: "bg-neutral-bg text-neutral-ink",
};

/** «7 reps · 13 jul. 2026» i, si n'hi ha un d'anterior, «+2 respecte de l'anterior». */
export function TestHeadline({
  entries,
  unit,
  betterWhen,
  locale,
  labels,
}: {
  entries: Entry[];
  unit: string | null;
  betterWhen: BetterWhen;
  locale: Locale;
  labels: { last: string; vsPrevious: string; none: string };
}) {
  const last = entries[entries.length - 1];
  if (!last) return <p className="text-sm text-brand-muted">{labels.none}</p>;
  const trend = trendOf(
    entries.map((e) => e.value),
    betterWhen,
  );
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
      <p>
        <span className="sr-only">{labels.last}: </span>
        <span className="text-2xl font-bold text-brand-dark tabular-nums">{formatValue(last.value, locale)}</span>
        {unit && <span className="ml-1 text-sm font-bold text-brand-muted">{unit}</span>}
        <span className="ml-2 text-xs text-brand-muted">{formatDate(last.measuredOn, locale)}</span>
      </p>
      {trend && (
        <p className={clsx("rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums", TONE[trend.tone])}>
          {withUnit(formatDiff(trend.diff, locale), unit)} <span className="font-normal">{labels.vsPrevious}</span>
        </p>
      )}
    </div>
  );
}

/**
 * La gràfica d'un test: la línia en el temps, un punt per registre i el
 * darrer, més gros. Els rètols (màxim, mínim, primera i darrera data) són HTML
 * i no text dins de l'SVG: així no creixen amb la caixa i es llegeixen igual a
 * 375 px que a pantalla gran.
 */
export function TestChart({
  entries,
  unit,
  locale,
  ariaLabel,
}: {
  entries: Entry[];
  unit: string | null;
  locale: Locale;
  ariaLabel: string;
}) {
  const g = chartGeometry(entries);
  if (!g) return null;
  const { w, h } = CHART;
  const last = g.points[g.points.length - 1];
  const sameValue = g.max === g.min;
  const pct = (y: number) => `${(y / h) * 100}%`;

  return (
    <figure className="flex w-full max-w-xl flex-col gap-1">
      <div className="flex items-stretch gap-2">
        {/* Màxim i mínim, a l'altura de la seva línia. */}
        <div
          className="relative w-14 shrink-0 text-right text-[11px] leading-none text-brand-muted tabular-nums"
          aria-hidden
        >
          <span className="absolute right-0 -translate-y-1/2" style={{ top: pct(g.yMax) }}>
            {withUnit(formatValue(g.max, locale), unit)}
          </span>
          {!sameValue && (
            <span className="absolute right-0 -translate-y-1/2" style={{ top: pct(g.yMin) }}>
              {withUnit(formatValue(g.min, locale), unit)}
            </span>
          )}
        </div>
        {/* `min-w-0` i no `w-full`: amb la columna dels rètols al costat, un 100 % sortiria de la targeta. */}
        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="block h-auto w-full overflow-visible"
            role="img"
            aria-label={ariaLabel}
          >
            <line
              x1={0}
              x2={w}
              y1={g.yMax}
              y2={g.yMax}
              className="stroke-brand-border"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {!sameValue && (
              <line
                x1={0}
                x2={w}
                y1={g.yMin}
                y2={g.yMin}
                className="stroke-brand-border"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {g.points.length > 1 && (
              <polyline
                points={g.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                className="stroke-brand-purple"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {g.points.slice(0, -1).map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                className="fill-white stroke-brand-purple"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <circle cx={last.x} cy={last.y} r={4.5} className="fill-brand-purple" />
          </svg>
        </div>
      </div>
      {/* Primera i darrera data, sota la línia. */}
      <figcaption className="flex justify-between gap-2 pl-16 text-[11px] text-brand-muted tabular-nums" aria-hidden>
        <span>{formatDate(entries[0].measuredOn, locale)}</span>
        {entries.length > 1 && <span>{formatDate(entries[entries.length - 1].measuredOn, locale)}</span>}
      </figcaption>
    </figure>
  );
}

/** Text per a lectors de pantalla: «Dominades: de 3 a 7 reps, entre … i …». */
export function chartAria(
  title: string,
  entries: Entry[],
  unit: string | null,
  locale: Locale,
  template: (v: { title: string; first: string; last: string; from: string; to: string }) => string,
): string {
  const first = entries[0];
  const last = entries[entries.length - 1];
  return template({
    title,
    first: withUnit(formatValue(first.value, locale), unit),
    last: withUnit(formatValue(last.value, locale), unit),
    from: formatDate(first.measuredOn, locale),
    to: formatDate(last.measuredOn, locale),
  });
}
