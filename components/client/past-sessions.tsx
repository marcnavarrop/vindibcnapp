"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/labels";
import type { PastSession } from "@/lib/data/session-notes";
import type { Locale } from "@/lib/i18n/config";

/**
 * Les sessions que el client ja ha fet, amb la nota del professional si n'hi ha.
 *
 * Aquesta pantalla no existia: /client/reservas és un calendari per RESERVAR, i
 * no hi havia enlloc on el client pogués mirar enrere. La nota de sessió obliga
 * a tenir-lo, perquè si no s'escriuria per a ningú.
 *
 * El COS de la nota no es tradueix mai: és text lliure que ha escrit el centre,
 * mateix criteri que els anuncis de la comunitat. El que sí que va en els tres
 * idiomes és tot el que l'envolta.
 */
export function PastSessions({ sessions }: { sessions: PastSession[] }) {
  const t = useTranslations("reservas.pastSessions");
  const tl = useTranslations("labels.service");
  const locale = useLocale() as Locale;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
        {t("title")}
      </h2>
      {sessions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">{t("empty")}</p>
      ) : (
        <div className="divide-y divide-brand-border">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-col gap-1 px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-bold text-brand-dark">
                  {formatDate(s.scheduledAt, locale)}
                </span>
                <span className="text-sm text-brand-muted">
                  {tl(s.serviceType)}
                </span>
                {s.trainerName && (
                  <span className="text-sm text-brand-muted">
                    {t("with", { name: s.trainerName })}
                  </span>
                )}
              </div>
              {s.note && (
                <div className="mt-1 rounded-lg bg-brand-bg px-3 py-2">
                  <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                    {t("noteTitle")}
                  </span>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-brand-charcoal">
                    {s.note.body}
                  </p>
                  <span className="mt-1 block text-xs text-brand-muted">
                    {t("by", {
                      name: s.note.authorName ?? "—",
                      date: formatDate(s.note.updatedAt, locale),
                    })}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
