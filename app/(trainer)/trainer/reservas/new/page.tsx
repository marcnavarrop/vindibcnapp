import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { ReservationForm } from "@/components/forms/reservation-form";
import { getReservationFormData } from "@/lib/data/reservations";
import { createTrainerReservationAction } from "@/app/(trainer)/trainer/reservas/actions";

export const dynamic = "force-dynamic";

export default async function NewTrainerReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { at } = await searchParams;
  const viewer = await getViewer();
  const { clients, trainers } = await getReservationFormData(viewer?.id);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/trainer/reservas"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar a l&apos;agenda
        </Link>
        <h1 className="mt-1 mb-2 text-2xl text-brand-dark">Nova reserva</h1>
        <p className="mb-6 max-w-xl text-sm text-brand-muted">
          Només pots crear reserves per als teus clients assignats.
        </p>

        {clients.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-sm text-brand-muted">
            No tens clients amb bons disponibles.
          </p>
        ) : (
          <ReservationForm
            clients={clients}
            trainers={trainers}
            action={createTrainerReservationAction}
            defaultScheduledAt={at}
          />
        )}
      </main>
  );
}
