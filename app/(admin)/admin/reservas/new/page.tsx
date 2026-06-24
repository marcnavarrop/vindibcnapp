import Link from "next/link";
import { ReservationForm } from "@/components/forms/reservation-form";
import { getReservationFormData } from "@/lib/data/reservations";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { at } = await searchParams;
  const { clients, trainers } = await getReservationFormData();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/reservas"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar a l&apos;agenda
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nova reserva</h1>

        <ReservationForm
          clients={clients}
          trainers={trainers}
          defaultScheduledAt={at}
        />
      </main>
  );
}
