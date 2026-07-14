import Link from "next/link";
import { ClientForm } from "@/components/forms/client-form";
import { listTrainers } from "@/lib/data/clients";
import { getTrialForConversion } from "@/lib/data/trial-bookings";
import { createClientAction } from "@/app/(admin)/admin/clients/actions";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ trial?: string }>;
}) {
  const { trial: trialId } = await searchParams;
  const [trainers, trial] = await Promise.all([
    listTrainers(),
    trialId ? getTrialForConversion(trialId) : Promise.resolve(null),
  ]);

  const defaults = trial
    ? {
        fullName: trial.fullName,
        email: trial.email,
        phone: trial.phone,
        assignedTrainerId: trial.trainerId ?? "",
        notes: "Prové d'una sessió de prova.",
      }
    : undefined;

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={trialId ? "/admin/prova" : "/admin/clients"}
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← {trialId ? "Sessions de prova" : "Clients"}
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">
          {trial ? "Convertir prova en client" : "Nou client"}
        </h1>

        <ClientForm
          action={createClientAction}
          trainers={trainers}
          defaults={defaults}
          trialId={trialId}
          submitLabel="Crear client"
          cancelHref={trialId ? "/admin/prova" : "/admin/clients"}
        />
      </main>
  );
}
