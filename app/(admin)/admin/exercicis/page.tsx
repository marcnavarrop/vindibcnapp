import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listExercises } from "@/lib/data/exercises";
import { deleteExerciseAction } from "@/app/(admin)/admin/exercicis/actions";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";

export const dynamic = "force-dynamic";

export default async function ExercicisPage() {
  const exercises = await listExercises();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl text-brand-dark">Biblioteca d&apos;exercicis</h1>
          <Link
            href="/admin/exercicis/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nou exercici
          </Link>
        </div>

        {exercises.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-center text-sm text-brand-muted">
            Encara no hi ha exercicis. Crea&apos;n el primer.
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
                <div className="mt-2 flex items-center gap-4">
                  <Link
                    href={`/admin/exercicis/${e.id}/edit`}
                    className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                  >
                    Editar
                  </Link>
                  <form action={deleteExerciseAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
  );
}
