import { Badge } from "@/components/ui/badge";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import type { AssignedExercise } from "@/lib/data/client-exercises";
import type { Exercise } from "@/lib/data/exercises";

/**
 * Sección "Exercicis assignats" de la ficha de cliente, compartida entre admin
 * y trainer. Si `canManage`, muestra el formulario de asignación y los botones
 * de eliminar; si no, solo la lista en lectura.
 */
export function AssignedExercisesPanel({
  assigned,
  library,
  canManage,
  assignAction,
  removeAction,
}: {
  assigned: AssignedExercise[];
  library: Exercise[];
  canManage: boolean;
  assignAction: (formData: FormData) => void | Promise<void>;
  removeAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Exercicis assignats
        </h2>
      </div>

      <div className="divide-y divide-brand-border">
        {assigned.length === 0 ? (
          <p className="px-5 py-3 text-sm text-brand-muted">
            Encara no hi ha exercicis assignats.
          </p>
        ) : (
          assigned.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm"
            >
              <div className="flex min-w-[12rem] flex-col gap-0.5">
                <span className="font-bold text-brand-dark">{a.name}</span>
                {a.notes && (
                  <span className="text-brand-muted">{a.notes}</span>
                )}
                <ExerciseVideoPlayer
                  videoUrl={a.videoUrl}
                  videoFilePath={a.videoFilePath}
                />
              </div>
              <Badge tone="info">{EXERCISE_CATEGORY_LABELS[a.category]}</Badge>
              {canManage && (
                <form action={removeAction} className="ml-auto">
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                  >
                    Treure
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      {canManage && library.length > 0 && (
        <form
          action={assignAction}
          className="flex flex-col gap-3 border-t border-brand-border p-5 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Exercici
            </span>
            <select
              name="exerciseId"
              required
              defaultValue=""
              className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
            >
              <option value="" disabled>
                Tria un exercici…
              </option>
              {library.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-sm">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Notes (opcional)
            </span>
            <input
              name="notes"
              placeholder="3 sèries de 12, dos cops/setmana"
              className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
          >
            Assignar
          </button>
        </form>
      )}
    </section>
  );
}
