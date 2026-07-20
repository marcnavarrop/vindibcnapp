import Link from "next/link";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/trainer/reservas", label: "Reserves" },
  { href: "/trainer/disponibilitat", label: "Disponibilitat" },
];
import { getViewer } from "@/lib/auth";
import { ReservationsView } from "@/components/reservations-view";
import { listReservations } from "@/lib/data/reservations";
import { listActiveTrialHolds } from "@/lib/data/trial-bookings";
import { listClients, listTrainers } from "@/lib/data/clients";
import { listAvailabilityLite } from "@/lib/data/availability";
import {
  cancelTrainerReservationAction,
  completeTrainerReservationAction,
  rescheduleTrainerReservationAction,
  acceptTrialTrainerAction,
  rejectTrialTrainerAction,
} from "@/app/(trainer)/trainer/reservas/actions";

export const dynamic = "force-dynamic";

export default async function TrainerReservasPage() {
  const viewer = await getViewer();
  const trainerId = viewer?.id;

  // Todas las reservas (coordinación) + las de MIS clientes (gestionables).
  const [reservations, trainers, myClients, availability, trials] =
    await Promise.all([
      listReservations(),
      listTrainers(),
      trainerId ? listClients(trainerId) : Promise.resolve([]),
      trainerId ? listAvailabilityLite(trainerId) : Promise.resolve([]),
      listActiveTrialHolds(),
    ]);
  // L'entrenador només gestiona (accepta/rebutja) les proves que són seves.
  const manageableTrialIds = trials
    .filter((t) => t.trainerId === trainerId)
    .map((t) => t.id);

  const myClientIds = new Set(myClients.map((c) => c.id));
  const manageableIds = reservations
    .filter((r) => myClientIds.has(r.clientId))
    .map((r) => r.id);

  const nowISO = new Date().toISOString();

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl text-brand-dark">Reserves</h1>
            <p className="mt-1 text-sm text-brand-muted">
              Veus l&apos;agenda completa del centre; només pots gestionar les
              dels teus clients.
            </p>
          </div>
          <Link
            href="/trainer/reservas/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nova reserva
          </Link>
        </div>

        <ReservationsView
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          manageableIds={manageableIds}
          newReservationBase="/trainer/reservas/new"
          cancelAction={cancelTrainerReservationAction}
          completeAction={completeTrainerReservationAction}
          rescheduleAction={rescheduleTrainerReservationAction}
          availability={availability}
          trials={trials}
          manageableTrialIds={manageableTrialIds}
          acceptTrialAction={acceptTrialTrainerAction}
          rejectTrialAction={rejectTrialTrainerAction}
        />
      </main>
    </>
  );
}
