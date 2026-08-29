import Link from "next/link";
import { ExerciseForm } from "@/components/forms/exercise-form";
import { createExerciseAction } from "@/lib/actions/exercise-actions";

const BASE = "/trainer/exercicis";

export default function NewTrainerExercisePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link
        href={BASE}
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Biblioteca
      </Link>
      <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nou exercici</h1>

      <ExerciseForm
        action={createExerciseAction.bind(null, BASE)}
        submitLabel="Crear exercici"
        cancelHref={BASE}
      />
    </main>
  );
}
