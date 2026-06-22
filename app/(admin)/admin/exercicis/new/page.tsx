import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { ExerciseForm } from "@/components/forms/exercise-form";
import { createExerciseAction } from "@/app/(admin)/admin/exercicis/actions";

export default function NewExercisePage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/exercicis"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Biblioteca
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nou exercici</h1>

        <ExerciseForm
          action={createExerciseAction}
          submitLabel="Crear exercici"
        />
      </main>
    </div>
  );
}
