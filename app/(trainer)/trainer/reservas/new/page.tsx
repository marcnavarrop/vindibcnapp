import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { ReservationForm } from "@/components/forms/reservation-form";
import { listTrainers } from "@/lib/data/clients";
import { getBookableClient, listBookableClients } from "@/lib/data/slot-booking";
import { createTrainerReservationAction } from "@/app/(trainer)/trainer/reservas/actions";
import { TAP } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewTrainerReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; client?: string }>;
}) {
  const { at, client: clientParam } = await searchParams;
  const viewer = await getViewer();
  // Només cal saber si en té cap: el formulari els busca al servidor, i el
  // buscador només li ensenya els seus assignats.
  // `?client=` arriba de la fitxa del client: es posa ja triat, si és seu.
  const [trainers, clients, defaultClient] = await Promise.all([
    listTrainers(),
    viewer ? listBookableClients(viewer.id) : Promise.resolve([]),
    viewer && clientParam ? getBookableClient(clientParam, viewer.id) : Promise.resolve(null),
  ]);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/trainer/reservas"
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar a l&apos;agenda
        </Link>
        <h1 className="mt-1 mb-2 text-2xl text-brand-dark">Nova reserva</h1>
        <p className="mb-6 max-w-xl text-sm text-brand-muted">
          Només pots crear reserves per als teus clients assignats.
        </p>

        {clients.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-sm text-brand-muted">
            No tens cap client assignat.
          </p>
        ) : (
          <ReservationForm
            trainers={trainers}
            action={createTrainerReservationAction}
            cancelHref="/trainer/reservas"
            defaultScheduledAt={at}
            /*
             * Ell mateix, sempre, vingui o no d'una franja.
             *
             * A la seva agenda no hi ha capes de diversos professionals
             * (`showCalendarFilters` és només de l'admin): una franja d'aquí
             * només pot voler dir "jo". I encara que entri per «Nova reserva»
             * sense franja, el professional que té sentit és ell. Fins ara el
             * desplegable li sortia buit i amb el company a dins, de manera que
             * havia de triar-se a si mateix d'una llista que li oferia
             * assignar-la a un altre.
             */
            defaultTrainerId={viewer?.id}
            defaultClient={defaultClient}
          />
        )}
      </main>
  );
}
