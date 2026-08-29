import Link from "next/link";
import { listExerciseCategories } from "@/lib/data/exercise-categories";
import { ExerciseCategoriesManager } from "@/components/exercise-categories-manager";

export const dynamic = "force-dynamic";

const BASE = "/admin/exercicis";

export default async function AdminExerciseCategoriesPage() {
  const categories = await listExerciseCategories();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link
        href={BASE}
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Biblioteca
      </Link>
      <h1 className="mt-1 mb-1 text-2xl text-brand-dark">Categories d&apos;exercicis</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Les fa servir tot el centre. Una categoria amb exercicis no es pot
        esborrar: primer cal moure&apos;ls o esborrar-los.
      </p>

      <ExerciseCategoriesManager categories={categories} basePath={BASE} />
    </main>
  );
}
