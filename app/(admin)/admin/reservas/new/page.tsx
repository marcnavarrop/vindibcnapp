import Link from "next/link";
import { ReservationForm } from "@/components/forms/reservation-form";
import { listTrainers } from "@/lib/data/clients";
import { getBookableClient } from "@/lib/data/slot-booking";
import { TAP } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; trainer?: string; client?: string }>;
}) {
  const { at, trainer, client } = await searchParams;
  // Els clients ja no es carreguen aquí: el formulari els busca al servidor.
  // `?client=` arriba de la fitxa del client: es posa ja triat.
  const [trainers, defaultClient] = await Promise.all([
    listTrainers(),
    client ? getBookableClient(client, null) : Promise.resolve(null),
  ]);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/reservas"
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar a l&apos;agenda
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nova reserva</h1>

        <ReservationForm
          trainers={trainers}
          cancelHref="/admin/reservas"
          defaultScheduledAt={at}
          // El calendari només l'envia quan la franja assenyala un sol
          // professional; la resta de vegades no arriba i el camp surt buit.
          defaultTrainerId={trainer}
          defaultClient={defaultClient}
        />
      </main>
  );
}
