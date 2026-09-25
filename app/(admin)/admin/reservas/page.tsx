import Link from "next/link";
import { TAP } from "@/lib/utils";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/disponibilitat", label: "Disponibilitat" },
  { href: "/admin/prova", label: "Sessions de prova" },
];
import { ReservationsView } from "@/components/reservations-view";
import { getNotesForReservations } from "@/lib/data/session-notes";
import { listReservationsInRange } from "@/lib/data/reservations";
import { agendaWindow } from "@/lib/agenda-window";
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

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Només la setmana del calendari o els dies de la llista: vegeu `agendaWindow`.
  const { nav, from, to } = agendaWindow("/admin/reservas", await searchParams);
  const [reservations, trainers, trials, centerSettings, allAvailability, allBlocks, palette] =
    await Promise.all([
      listReservationsInRange({ from, to }),
      listTrainers(),
      listActiveTrialHolds({ from, to }),
      getCenterSettings(),
      // Per a la capa opcional de disponibilitat del calendari.
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
      getColorPalette(),
    ]);
  const nowISO = new Date().toISOString();
  // L'administració LLEGEIX les notes i no n'escriu cap: no es passa
  // `noteableIds`, i sense llista el panell no ofereix formulari. És la
  // desviació deliberada del patró `*_admin_write` que documenta la 0079, i
  // aquí és només cosmètica: encara que el formulari sortís, la policy no
  // deixaria desar res.
  const { notes: noteMap, failed: notesFailed } = await getNotesForReservations(
    reservations.filter((r) => r.scheduledAt <= nowISO).map((r) => r.id),
  );
  const notes = Object.fromEntries(noteMap);

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
          nav={nav}
          notesFailed={notesFailed}
          palette={palette}
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          clientBase="/admin/clients"
          notes={notes}
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
