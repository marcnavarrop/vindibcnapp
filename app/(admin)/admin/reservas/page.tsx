import Link from "next/link";
import { TAP } from "@/lib/utils";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/disponibilitat", label: "Disponibilitat" },
  { href: "/admin/prova", label: "Sessions de prova" },
];
import { ReservationsView } from "@/components/reservations-view";
import { listReservations } from "@/lib/data/reservations";
import { listActiveTrialHolds } from "@/lib/data/trial-bookings";
import { listTrainers } from "@/lib/data/clients";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { listAllBlocksLite } from "@/lib/data/availability-blocks";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
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
  const [reservations, trainers, trials, centerSettings, allAvailability, allBlocks, palette] =
    await Promise.all([
      listReservations(),
      listTrainers(),
      listActiveTrialHolds(),
      getCenterSettings(),
      // Per a la capa opcional de disponibilitat del calendari.
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
      getColorPalette(),
    ]);
  const nowISO = new Date().toISOString();

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
            >
              ← Tornar
            </Link>
            <h1 className="mt-1 text-2xl text-brand-dark">Agenda de reserves</h1>
          </div>
          <Link
            href="/admin/reservas/new"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nova reserva
          </Link>
        </div>

        <ReservationsView
          palette={palette}
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          newReservationBase="/admin/reservas/new"
          openingHour={centerSettings.openingHour}
          closingHour={centerSettings.closingHour}
          cancelAction={cancelReservationAction}
          completeAction={completeReservationAction}
          rescheduleAction={rescheduleReservationAction}
          trials={trials}
          manageableTrialIds={trials.map((t) => t.id)}
          acceptTrialAction={acceptTrialAdminAction}
          rejectTrialAction={rejectTrialAdminAction}
          allAvailability={allAvailability}
          allBlocks={allBlocks}
          showCalendarFilters
        />
      </main>
    </>
  );
}
