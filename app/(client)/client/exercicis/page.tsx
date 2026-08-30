import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listExercises } from "@/lib/data/exercises";
import { listAllProgressForClient } from "@/lib/data/exercise-progress";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/labels";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function ClientExercicisPage() {
  const t = await getTranslations("workouts");
  const tv = await getTranslations("workouts.video");
  const locale = (await getLocale()) as Locale;
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const [assigned, library, allProgress] = await Promise.all([
    client ? listClientExercises(client.id) : Promise.resolve([]),
    listExercises(),
    client ? listAllProgressForClient(client.id) : Promise.resolve([]),
  ]);

  const progressByAssignment = new Map(
    assigned.map((a) => [
      a.id,
      allProgress.filter((p) => p.clientExerciseId === a.id),
    ]),
  );

  // El reproductor és compartit amb l'àrea d'admin: rep el text ja traduït.
  const videoTexts = {
    watch: tv("watch"),
    loading: tv("loading"),
    error: tv("error"),
    play: tv("play"),
    retry: tv("retry"),
  };

  const assignedIds = new Set(assigned.map((a) => a.exerciseId));
  const rest = library.filter((e) => !assignedIds.has(e.id));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">{t("intro")}</p>

      {/* Els teus exercicis (destacats) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-purple uppercase">
          {t("yours")}
        </h2>
        {assigned.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
            {t("noneAssigned")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {assigned.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-2xl border-2 border-brand-purple/30 bg-brand-purple/5 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg text-brand-dark">{a.name}</h3>
                  <Badge tone="info">
                    {a.categoryName}
                  </Badge>
                </div>
                {a.notes && (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand-charcoal">
                    {a.notes}
                  </p>
                )}
                {a.description && (
                  <p className="text-sm text-brand-muted">{a.description}</p>
                )}
                <ExerciseVideoPlayer
                  videoUrl={a.videoUrl}
                  videoFilePath={a.videoFilePath}
                  texts={videoTexts}
                />
                {/* Historial de progrés (read-only) */}
                {(progressByAssignment.get(a.id) ?? []).length > 0 && (
                  <div className="mt-1 border-t border-brand-purple/20 pt-3">
                    <p className="mb-1.5 text-xs font-bold tracking-wide text-brand-purple uppercase">
                      {t("progress")}
                    </p>
                    <div className="flex flex-col gap-1">
                      {(progressByAssignment.get(a.id) ?? []).map((ep) => (
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
            ))}
          </div>
        )}
      </section>

      {/* Biblioteca completa (lectura) */}
      <section>
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
          {t("library")}
        </h2>
        {rest.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
            {t("libraryEmpty")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg text-brand-dark">{e.name}</h3>
                  <Badge tone="info">
                    {e.categoryName}
                  </Badge>
                </div>
                {e.description && (
                  <p className="text-sm text-brand-muted">{e.description}</p>
                )}
                <ExerciseVideoPlayer
                  videoUrl={e.videoUrl}
                  videoFilePath={e.videoFilePath}
                  texts={videoTexts}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
