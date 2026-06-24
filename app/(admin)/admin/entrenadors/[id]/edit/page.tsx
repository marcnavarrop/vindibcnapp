import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { TrainerForm } from "@/components/forms/trainer-form";
import { updateTrainerSpecialtyAction } from "@/app/(admin)/admin/entrenadors/actions";
import { getTrainer } from "@/lib/data/trainers";

export const dynamic = "force-dynamic";

export default async function EditTrainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await getTrainer(id);
  if (!trainer) notFound();

  const action = updateTrainerSpecialtyAction.bind(null, id);

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/entrenadors"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">
          Editar especialitat
        </h1>

        <TrainerForm
          action={action}
          editableIdentity={false}
          defaults={{
            fullName: trainer.fullName,
            email: trainer.email,
            specialty: trainer.specialty,
          }}
          submitLabel="Desar"
          cancelHref="/admin/entrenadors"
        />
      </main>
    </div>
  );
}
