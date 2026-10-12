import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { ReservationForm } from "@/components/forms/reservation-form";
import { listTrainers } from "@/lib/data/clients";
import { getBookableClient } from "@/lib/data/slot-booking";
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
  // El client es busca al servidor, entre tots els del centre (0107).
  // `?client=` arriba de la fitxa del client: es posa ja triat, tal com el veu
  // aquest professional (si no és seu, amb només els bons que hi pot gastar).
  const [trainers, defaultClient] = await Promise.all([
    listTrainers(),
    viewer && clientParam
      ? getBookableClient(clientParam, {
          id: viewer.id,
          specialty: viewer.specialty,
        })
      : Promise.resolve(null),
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
        Als teus clients, el que calgui, a qualsevol agenda. A la resta de
        clients del centre, amb bo: un grup (de qualsevol professional) o la
        teva especialitat a la teva agenda.
      </p>

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
    </main>
  );
}
