import Link from "next/link";
import { TAP } from "@/lib/utils";
import { GroupTabs } from "@/components/ui/group-tabs";
import { SupportInlineButton } from "@/components/support-inline-button";

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
import { listAllBlocksLite, listBlocksForAdmin } from "@/lib/data/availability-blocks";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { listWaitingForAdmin } from "@/lib/data/waitlist";
import {
  addDaysStr,
  centerDateStr,
  centerDayStart,
  centerToday,
} from "@/lib/center-time";
import {
  cancelReservationAction,
  completeReservationAction,
  createFromSlotAdminAction,
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
  const win = agendaWindow("/admin/reservas", await searchParams);
  const { nav } = win;
  // Al calendari, a més, de avui a quinze dies: «Pròxim forat» busca el primer
  // forat lliure de cada professional en les dues setmanes vinents, i per saber
  // què és lliure cal saber què hi ha reservat.
  const today = centerToday();
  const lookFrom = centerDayStart(today);
  const lookTo = centerDayStart(addDaysStr(today, 15));
  const from =
    nav.view === "calendar" && lookFrom < win.from ? lookFrom : win.from;
  const to = nav.view === "calendar" && lookTo > win.to ? lookTo : win.to;
  const [reservations, trainers, trials, centerSettings, allAvailability, allBlocks, centerBlocks, palette, waiting] =
    await Promise.all([
      listReservationsInRange({ from, to }),
      listTrainers(),
      listActiveTrialHolds({ from, to }),
      getCenterSettings(),
      // Per als forats reals de cada professional.
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
      // Els bloquejos amb el motiu, per pintar-los: una consulta només de
      // l'admin, a part de la que alimenta /prova i el calendari del client.
      listBlocksForAdmin({ from, to }),
      getColorPalette(),
      // Qui espera plaça, amb el nom: també només de l'admin.
      listWaitingForAdmin({ fromDay: centerDateStr(new Date(from)), toDay: centerDateStr(new Date(to)) }),
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
      <main className="mx-auto max-w-5xl px-4 pt-3 pb-6 md:p-6">
        {/* Al mòbil, una sola fila, com la del professional: l'agenda ha de
            començar tan amunt com es pugui. El suport va aquí dins i no
            flotant, que tapava la columna de la dreta. */}
        <div className="mb-3 flex items-center justify-between gap-2 md:mb-6 md:gap-4">
          <div>
            <Link
              href="/admin"
              className={`hidden text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple md:inline ${TAP}`}
            >
              ← Tornar
            </Link>
            <h1 className="text-2xl text-brand-dark md:mt-1">
              Agenda<span className="hidden sm:inline"> de reserves</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SupportInlineButton />
            <Link
              href="/admin/reservas/new"
              className={`inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark md:h-10 ${TAP}`}
            >
              + Nova<span className="hidden sm:inline">&nbsp;reserva</span>
            </Link>
          </div>
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
          calendar="admin"
          centerBlocks={centerBlocks}
          centerWaiting={waiting}
          createFromSlotAction={createFromSlotAdminAction}
        />
      </main>
    </>
  );
}
