import Link from "next/link";
import { listExercises } from "@/lib/data/exercises";
import { listExerciseCategories } from "@/lib/data/exercise-categories";
import { deleteExerciseAction } from "@/lib/actions/exercise-actions";
import { ExerciseLibrary } from "@/components/exercise-library";

export const dynamic = "force-dynamic";

const BASE = "/admin/exercicis";

export default async function AdminExercicisPage() {
  const [exercises, categories] = await Promise.all([
    listExercises(),
    listExerciseCategories(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Biblioteca d&apos;exercicis</h1>
        <Link
          href={`${BASE}/new`}
          className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
        >
          + Nou exercici
        </Link>
      </div>

      <ExerciseLibrary
        exercises={exercises}
        categories={categories}
        basePath={BASE}
        deleteAction={deleteExerciseAction.bind(null, BASE)}
      />
    </main>
  );
}
