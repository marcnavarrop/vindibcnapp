import { Badge } from "@/components/ui/badge";
import { listExercises } from "@/lib/data/exercises";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";

export const dynamic = "force-dynamic";

export default async function TrainerExercicisPage() {
  const exercises = await listExercises();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">
          Biblioteca d&apos;exercicis
        </h1>
        <p className="mb-6 text-sm text-brand-muted">
          Consulta dels exercicis del centre.
        </p>

        {exercises.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-center text-sm text-brand-muted">
            Encara no hi ha exercicis.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {exercises.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg text-brand-dark">{e.name}</h2>
                  <Badge tone="info">
                    {EXERCISE_CATEGORY_LABELS[e.category]}
                  </Badge>
                </div>
                {e.description && (
                  <p className="text-sm text-brand-muted">{e.description}</p>
                )}
                <ExerciseVideoPlayer
                  videoUrl={e.videoUrl}
                  videoFilePath={e.videoFilePath}
                />
              </div>
            ))}
          </div>
        )}
      </main>
  );
}
