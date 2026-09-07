import Link from "next/link";
import { TAP } from "@/lib/utils";
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
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { listAllBlocksLite } from "@/lib/data/availability-blocks";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { getNotesForReservations } from "@/lib/data/session-notes";
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
  const [
    reservations,
    trainers,
    myClients,
    allAvailability,
    allBlocks,
    trials,
    centerSettings,
    palette,
  ] = await Promise.all([
      listReservations(),
      listTrainers(),
      trainerId ? listClients(trainerId) : Promise.resolve([]),
      listAllTrainerRulesLite(),
      listAllBlocksLite(),
      listActiveTrialHolds(),
      getCenterSettings(),
      getColorPalette(),
    ]);
  // L'entrenador només gestiona (accepta/rebutja) les proves que són seves.
  const manageableTrialIds = trials
    .filter((t) => t.trainerId === trainerId)
    .map((t) => t.id);

  const myClientIds = new Set(myClients.map((c) => c.id));
  const manageableIds = reservations
    .filter((r) => myClientIds.has(r.clientId))
    .map((r) => r.id);

  // LES NOTES VAN PER UNA ALTRA LLISTA, i la diferència és tot el sentit de la
  // funció: `manageableIds` són les reserves dels MEUS CLIENTS —hi puc marcar
  // "Fet" encara que la sessió la donés un company—, i això són les que vaig
  // donar JO. La nota d'una sessió és de qui la va fer, no de qui coordina.
  //
  // Si algú les unifica algun dia "perquè s'assemblen", la policy de la 0079
  // seguirà dient que no: el formulari sortiria i el desat fallaria. Millor
  // que no surti.
  const noteableIds = reservations
    .filter((r) => r.trainerId === trainerId)
    .map((r) => r.id);

  // Si l'ajust de centre ho desactiva, el trainer només veu les seves pròpies reserves.
  const visibleReservations =
    centerSettings.trainersSeColleaguesReservations
      ? reservations
      : reservations.filter((r) => r.trainerId === trainerId);

  // Només les passades: són les úniques on la nota té sentit i on es pinta.
  const nowISO = new Date().toISOString();
  const notes = Object.fromEntries(
    await getNotesForReservations(
      visibleReservations
        .filter((r) => r.scheduledAt <= nowISO)
        .map((r) => r.id),
    ),
  );

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
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nova reserva
          </Link>
        </div>

        <ReservationsView
          palette={palette}
          reservations={visibleReservations}
          trainers={trainers}
          nowISO={nowISO}
          manageableIds={manageableIds}
          notes={notes}
          noteableIds={noteableIds}
          newReservationBase="/trainer/reservas/new"
          cancelAction={cancelTrainerReservationAction}
          completeAction={completeTrainerReservationAction}
          rescheduleAction={rescheduleTrainerReservationAction}
          allAvailability={allAvailability}
          allBlocks={allBlocks}
          myTrainerId={trainerId}
          trials={trials}
          manageableTrialIds={manageableTrialIds}
          acceptTrialAction={acceptTrialTrainerAction}
          rejectTrialAction={rejectTrialTrainerAction}
          showColleagueSelector={centerSettings.trainersSeColleaguesReservations}
          openingHour={centerSettings.openingHour}
          closingHour={centerSettings.closingHour}
        />
      </main>
    </>
  );
}
