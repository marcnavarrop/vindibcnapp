"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createExerciseCategoryAction,
  deleteExerciseCategoryAction,
  type CategoryFormState,
} from "@/lib/actions/exercise-category-actions";
import type { ExerciseCategoryItem } from "@/lib/data/exercise-categories";

/**
 * Gestió de categories: crear-ne i esborrar-ne.
 *
 * Una categoria amb exercicis NO s'esborra, i el botó ni tan sols hi és: el
 * recompte al costat ja explica per què. Dir "no es pot" amb el botó actiu i un
 * error després obliga a provar-ho per saber-ho.
 */
export function ExerciseCategoriesManager({
  categories,
  basePath,
}: {
  categories: ExerciseCategoryItem[];
  basePath: string;
}) {
  const [createState, createAction] = useActionState(
    createExerciseCategoryAction.bind(null, basePath),
    {} as CategoryFormState,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteExerciseCategoryAction.bind(null, basePath),
    {} as CategoryFormState,
  );

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <form
        action={createAction}
        className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-5"
      >
        <div>
          <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
            Nova categoria
          </h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            Si ja n&apos;hi ha una amb aquest nom, es fa servir la que hi ha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            placeholder="Ex.: Estiraments"
            className="min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
          />
          <SubmitButton pendingLabel="Creant…">Crear</SubmitButton>
        </div>
        {createState.error && (
          <p className="text-sm text-error">{createState.error}</p>
        )}
        {createState.created && (
          <p className="text-sm font-bold text-success">
            Categoria «{createState.created.name}» creada.
          </p>
        )}
      </form>

      <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
        <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
          Categories ({categories.length})
        </h2>

        {categories.length === 0 ? (
          <p className="px-5 py-4 text-sm text-brand-muted">
            Encara no n&apos;hi ha cap.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm"
              >
                <span className="font-bold text-brand-dark">{c.name}</span>
                <span className="text-brand-muted">
                  {c.exerciseCount === 0
                    ? "sense exercicis"
                    : c.exerciseCount === 1
                      ? "1 exercici"
                      : `${c.exerciseCount} exercicis`}
                </span>

                <div className="ml-auto">
                  {c.exerciseCount === 0 ? (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton
                        variant="outline"
                        pendingLabel="Esborrant…"
                        className="!px-2.5 !py-1 !text-xs"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Esborrar
                        </span>
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-brand-muted">
                      En ús: no es pot esborrar
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {deleteState.error && (
          <p className="border-t border-brand-border px-5 py-3 text-sm text-error">
            {deleteState.error}
          </p>
        )}
      </section>
    </div>
  );
}
