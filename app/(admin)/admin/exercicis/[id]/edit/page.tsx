import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ExerciseForm } from "@/components/forms/exercise-form";
import { getExercise } from "@/lib/data/exercises";
import { updateExerciseAction } from "@/app/(admin)/admin/exercicis/actions";

export const dynamic = "force-dynamic";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercise = await getExercise(id);
  if (!exercise) notFound();

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
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar exercici</h1>

        <ExerciseForm
          action={updateExerciseAction.bind(null, id)}
          submitLabel="Desar canvis"
          defaults={{
            name: exercise.name,
            category: exercise.category,
            description: exercise.description ?? "",
            videoUrl: exercise.videoUrl ?? "",
          }}
        />
      </main>
    </div>
  );
}
