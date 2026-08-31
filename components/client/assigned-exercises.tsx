"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  VideoIndicator,
  VideoDialog,
  videoKind,
  type LibraryTexts,
} from "@/components/exercise-library";
import { formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { AssignedExercise } from "@/lib/data/client-exercises";
import type { ExerciseProgressEntry } from "@/lib/data/exercise-progress";

/**
 * Els exercicis que el professional ha assignat, amb el seu progrés.
 *
 * Comparteix amb la biblioteca de sota la fitxa compacta, la icona que diu
 * quina mena de vídeo és i el diàleg que l'obre: abans aquesta secció muntava
 * el reproductor gran a cada targeta i la de sota la icona petita, i eren dues
 * maneres diferents de fer el mateix a la mateixa pantalla.
 *
 * El que NO comparteix és el contingut propi: les notes del professional i
 * l'historial de càrregues i repeticions. Això no és de la biblioteca del
 * centre, és d'aquest client, i es queda tal com estava.
 *
 * Manté l'accent lila: dins de la mateixa pantalla, "el que t'han posat a tu"
 * i "tot el que hi ha al centre" segueixen sent coses diferents i val la pena
 * que es distingeixin d'un cop d'ull.
 */
export function AssignedExercises({
  assigned,
  progressByAssignment,
}: {
  assigned: AssignedExercise[];
  /** Registres de progrés per id d'assignació. */
  progressByAssignment: Record<string, ExerciseProgressEntry[]>;
}) {
  const t = useTranslations("workouts");
  const tl = useTranslations("workouts.lib");
  const locale = useLocale() as Locale;
  const [playing, setPlaying] = useState<AssignedExercise | null>(null);

  // Del diàleg i la icona només se'n fan servir aquests textos, però es passa
  // el joc sencer perquè el tipus és el mateix que a la biblioteca.
  const texts = {
    noVideo: tl("noVideo"),
    watch: tl("watch"),
    watchYoutube: tl("watchYoutube"),
    openExternal: tl("openExternal"),
    openExternalAria: tl("openExternalAria"),
    close: tl("close"),
    loading: tl("loading"),
    videoError: tl("videoError"),
  } as LibraryTexts;

  if (assigned.length === 0)
    return (
      <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
        {t("noneAssigned")}
      </p>
    );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assigned.map((a) => {
          const progress = progressByAssignment[a.id] ?? [];
          return (
            <div
              key={a.id}
              className="flex flex-col gap-2 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base leading-tight font-bold text-brand-dark">
                  {a.name}
                </h3>
                <Badge tone="info">{a.categoryName}</Badge>
              </div>

              {/* La nota del professional va sencera: és una instrucció per a
                  aquesta persona, no una descripció del catàleg. */}
              {a.notes && (
                <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand-charcoal">
                  {a.notes}
                </p>
              )}

              {a.description && (
                <p className="line-clamp-2 text-sm text-brand-muted">
                  {a.description}
                </p>
              )}

              <div className="mt-auto flex items-center gap-3 pt-2">
                <VideoIndicator
                  kind={videoKind(a)}
                  url={a.videoUrl}
                  texts={texts}
                  onPlay={() => setPlaying(a)}
                />
              </div>

              {progress.length > 0 && (
                <div className="mt-1 border-t border-brand-purple/20 pt-3">
                  <p className="mb-1.5 text-xs font-bold tracking-wide text-brand-purple uppercase">
                    {t("progress")}
                  </p>
                  <div className="flex flex-col gap-1">
                    {progress.map((ep) => (
                      <div
                        key={ep.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
                      >
                        <span className="text-brand-muted">
                          {formatDate(ep.recordedAt, locale)}
                        </span>
                        <span className="font-bold text-brand-dark">
                          {ep.weightKg} kg
                        </span>
                        {ep.reps != null && (
                          <span className="text-brand-muted">
                            {t("reps", { count: ep.reps })}
                          </span>
                        )}
                        {ep.notes && (
                          <span className="text-brand-muted">{ep.notes}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {playing && (
        <VideoDialog
          exercise={playing}
          texts={texts}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  );
}
