import { addProgressAction, deleteProgressAction } from "@/app/actions/client-progress-actions";
import type { AssignedExercise } from "@/lib/data/client-exercises";
import type { ExerciseProgressEntry } from "@/lib/data/exercise-progress";
import { formatDate } from "@/lib/labels";

export function ClientProgressPanel({
  assigned,
  allProgress,
  canManage,
  redirectPath,
}: {
  assigned: AssignedExercise[];
  allProgress: ExerciseProgressEntry[];
  canManage: boolean;
  redirectPath: string;
}) {
  const progressByAssignment = new Map<string, ExerciseProgressEntry[]>();
  for (const ep of allProgress) {
    const list = progressByAssignment.get(ep.clientExerciseId) ?? [];
    list.push(ep);
    progressByAssignment.set(ep.clientExerciseId, list);
  }

  if (assigned.length === 0) {
    return (
      <p className="rounded-xl border border-brand-border bg-white px-5 py-4 text-sm text-brand-muted">
        El client no té cap exercici assignat encara.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {assigned.map((a) => {
        const entries = progressByAssignment.get(a.id) ?? [];
        return (
          <section
            key={a.id}
            className="overflow-hidden rounded-2xl border border-brand-border bg-white"
          >
            <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
              <h3 className="text-sm font-bold text-brand-dark">{a.name}</h3>
              {a.notes && (
                <p className="text-xs text-brand-muted">{a.notes}</p>
              )}
            </div>

            {entries.length === 0 ? (
              <p className="px-5 py-3 text-sm text-brand-muted">
                Sense registres de progrés.
              </p>
            ) : (
              <div className="divide-y divide-brand-border">
                {entries.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm"
                  >
                    <span className="font-bold text-brand-dark">
                      {formatDate(ep.recordedAt)}
                    </span>
                    <span className="font-bold text-brand-purple">
                      {ep.weightKg} kg
                    </span>
                    {ep.reps != null && (
                      <span className="text-brand-muted">{ep.reps} reps</span>
                    )}
                    {ep.notes && (
                      <span className="text-brand-muted">{ep.notes}</span>
                    )}
                    {canManage && (
                      <form action={deleteProgressAction} className="ml-auto">
                        <input type="hidden" name="id" value={ep.id} />
                        <input type="hidden" name="redirectPath" value={redirectPath} />
                        <button
                          type="submit"
                          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                        >
                          Eliminar
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <form
                action={addProgressAction}
                className="flex flex-wrap items-end gap-3 border-t border-brand-border bg-brand-bg/50 px-5 py-3"
              >
                <input type="hidden" name="clientExerciseId" value={a.id} />
                <input type="hidden" name="redirectPath" value={redirectPath} />
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-bold tracking-wide text-brand-muted uppercase">
                    Data
                  </span>
                  <input
                    type="date"
                    name="recordedAt"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-bold tracking-wide text-brand-muted uppercase">
                    Càrrega (kg)
                  </span>
                  <input
                    type="number"
                    name="weightKg"
                    step="0.5"
                    min="0"
                    required
                    placeholder="0"
                    className="w-24 rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-bold tracking-wide text-brand-muted uppercase">
                    Reps
                  </span>
                  <input
                    type="number"
                    name="reps"
                    min="0"
                    placeholder="—"
                    className="w-20 rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs">
                  <span className="font-bold tracking-wide text-brand-muted uppercase">
                    Notes
                  </span>
                  <input
                    type="text"
                    name="notes"
                    placeholder="Opcional"
                    className="min-w-[8rem] rounded-lg border border-brand-border bg-white px-2 py-1.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
                >
                  + Registrar
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
