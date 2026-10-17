import { getLocale, getTranslations } from "next-intl/server";
import { TestChart, TestHeadline, chartAria } from "@/components/client-tests/test-visuals";
import { formatValue, withUnit } from "@/lib/client-tests";
import { formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { ClientTest } from "@/lib/data/client-tests";
import { TAP } from "@/lib/utils";

/**
 * Els tests d'avaluació del client (0113), a la seva pàgina d'exercicis, en
 * ca/es/en. Només lectura: els crea i els omple el seu professional. Les peces
 * (darrera marca, diferència i gràfica) són les mateixes de la fitxa.
 *
 * Component de servidor: no té res a fer al navegador més enllà del
 * desplegable dels registres, que és un `<details>`.
 */
export async function ClientTests({ tests }: { tests: ClientTest[] }) {
  const t = await getTranslations("workouts.tests");
  const locale = (await getLocale()) as Locale;
  const labels = { last: t("last"), vsPrevious: t("vsPrevious"), none: t("noEntries") };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {tests.map((test) => {
        const n = test.entries.length;
        return (
          <article key={test.id} className="flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-white">
            <header className="flex flex-col gap-1 border-b border-brand-border px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-base font-bold text-brand-dark">{test.title}</h3>
                {test.unit && <span className="text-sm text-brand-muted">({test.unit})</span>}
                {test.betterWhen !== "neutral" && (
                  <span className="text-xs font-bold text-brand-muted">
                    {test.betterWhen === "up" ? `↑ ${t("betterUp")}` : `↓ ${t("betterDown")}`}
                  </span>
                )}
              </div>
              {test.description && <p className="text-sm whitespace-pre-line text-brand-charcoal">{test.description}</p>}
            </header>

            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              <TestHeadline entries={test.entries} unit={test.unit} betterWhen={test.betterWhen} locale={locale} labels={labels} />
              {n > 0 && (
                <TestChart
                  entries={test.entries}
                  unit={test.unit}
                  locale={locale}
                  ariaLabel={chartAria(test.title, test.entries, test.unit, locale, (v) => t("chartAria", v))}
                />
              )}
            </div>

            {n > 0 && (
              <details className="border-t border-brand-border" open={n <= 3}>
                <summary className={`flex min-h-11 cursor-pointer items-center px-4 text-sm font-bold text-brand-purple sm:px-5 ${TAP}`}>
                  {t("entries", { count: n })}
                </summary>
                <ul className="divide-y divide-brand-border border-t border-brand-border">
                  {[...test.entries].reverse().map((e) => (
                    <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:px-5">
                      <span className="w-32 shrink-0 whitespace-nowrap text-brand-muted tabular-nums">{formatDate(e.measuredOn, locale)}</span>
                      <span className="font-bold text-brand-dark tabular-nums">{withUnit(formatValue(e.value, locale), test.unit)}</span>
                      {e.notes && <span className="min-w-0 basis-full text-brand-charcoal sm:basis-auto">{e.notes}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
