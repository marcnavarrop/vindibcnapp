import Link from "next/link";
import { ReservationsView } from "@/components/reservations-view";
import { listReservations } from "@/lib/data/reservations";
import { listActiveTrialHolds } from "@/lib/data/trial-bookings";
import { listTrainers } from "@/lib/data/clients";
import {
  cancelReservationAction,
  completeReservationAction,
  rescheduleReservationAction,
} from "@/app/(admin)/admin/reservas/actions";
import {
  acceptTrialAdminAction,
  rejectTrialAdminAction,
} from "@/app/(admin)/admin/prova/actions";

export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const [reservations, trainers, trials] = await Promise.all([
    listReservations(),
    listTrainers(),
    listActiveTrialHolds(),
  ]);
  const nowISO = new Date().toISOString();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
            >
              ← Tornar
            </Link>
            <h1 className="mt-1 text-2xl text-brand-dark">Agenda de reserves</h1>
          </div>
          <Link
            href="/admin/reservas/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nova reserva
          </Link>
        </div>

        <ReservationsView
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          newReservationBase="/admin/reservas/new"
          cancelAction={cancelReservationAction}
          completeAction={completeReservationAction}
          rescheduleAction={rescheduleReservationAction}
          trials={trials}
          manageableTrialIds={trials.map((t) => t.id)}
          acceptTrialAction={acceptTrialAdminAction}
          rejectTrialAction={rejectTrialAdminAction}
        />
      </main>
  );
}
