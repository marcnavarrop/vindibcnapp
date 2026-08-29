import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseForm } from "@/components/forms/exercise-form";
import { getExercise } from "@/lib/data/exercises";
import { updateExerciseAction } from "@/lib/actions/exercise-actions";

export const dynamic = "force-dynamic";

const BASE = "/trainer/exercicis";

export default async function EditTrainerExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercise = await getExercise(id);
  if (!exercise) notFound();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link
        href={BASE}
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Biblioteca
      </Link>
      <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar exercici</h1>

      <ExerciseForm
        action={updateExerciseAction.bind(null, BASE, id)}
        submitLabel="Desar canvis"
        cancelHref={BASE}
        defaults={{
          name: exercise.name,
          category: exercise.category,
          description: exercise.description ?? "",
          videoUrl: exercise.videoUrl ?? "",
          videoFilePath: exercise.videoFilePath,
        }}
      />
    </main>
  );
}
