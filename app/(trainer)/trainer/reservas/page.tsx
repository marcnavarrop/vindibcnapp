import Link from "next/link";
import { searchClientsAction } from "@/app/actions/client-search-actions";
import { staffBookingScope } from "@/lib/booking-scope";
import { demoCompatible } from "@/lib/demo-accounts";
import { getDemoWorld } from "@/lib/data/demo-world";
import { TAP } from "@/lib/utils";
import { GroupTabs } from "@/components/ui/group-tabs";
import { SupportInlineButton } from "@/components/support-inline-button";

const TABS = [
  { href: "/trainer/reservas", label: "Reserves" },
  { href: "/trainer/disponibilitat", label: "Disponibilitat" },
];
import { getViewer } from "@/lib/auth";
import { ReservationsView } from "@/components/reservations-view";
import { listReservationsInRange } from "@/lib/data/reservations";
import { agendaWindow } from "@/lib/agenda-window";
import { listActiveTrialHolds } from "@/lib/data/trial-bookings";
import { listClients, listTrainers } from "@/lib/data/clients";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { listAllBlocksLite, listOwnBlocksInRange } from "@/lib/data/availability-blocks";
import { countWaitingForTrainer } from "@/lib/data/waitlist";
import { centerDateStr } from "@/lib/center-time";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { getNotesForReservations } from "@/lib/data/session-notes";
import { getTrainerInbox } from "@/lib/data/trainer-inbox";
import { CalFerTray } from "@/components/cal-fer-tray";
import {
  cancelTrainerReservationAction,
  completeTrainerReservationAction,
  rescheduleTrainerReservationAction,
  acceptTrialTrainerAction,
  rejectTrialTrainerAction,
  createFromSlotAction,
} from "@/app/(trainer)/trainer/reservas/actions";

export const dynamic = "force-dynamic";

export default async function TrainerReservasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewer, params, centerSettings] = await Promise.all([
    getViewer(),
    searchParams,
    getCenterSettings(),
  ]);
  const trainerId = viewer?.id;

  // Només la setmana del calendari o els dies de la llista: vegeu `agendaWindow`.
  const { nav, from, to } = agendaWindow("/trainer/reservas", params);

  // Si l'ajust de centre amaga les dels companys, el filtre va A LA CONSULTA:
  // abans es portava tot el centre i es retallava després.
  const onlyMine = !centerSettings.trainersSeColleaguesReservations;
  const agendaOf = onlyMine ? (trainerId ?? "") : undefined;

  // Les reserves de la finestra (coordinació) + les de MIS clientes (gestionables).
  //
  // TOT EN UNA SOLA TANDA: els seus bloquejos, el recompte d'espera i «Cal fer»
  // només depenen del professional i de la finestra, no de les reserves. Abans
  // anaven en dues tandes més, una darrere l'altra.
  const [
    reservations,
    trainers,
    myClients,
    allAvailability,
    allBlocks,
    trials,
    palette,
    // Per a les senyals de la rejilla: els SEUS bloquejos amb el motiu, i
    // quanta gent espera plaça a les seves sessions (només el recompte). Si el
    // recompte falla, la rejilla es pinta igual, sense el «+N en espera».
    ownBlocks,
    waiting,
    // «Cal fer»: el que té pendent, acotat als últims dies (vegeu
    // trainer-inbox). Si falla, l'agenda es pinta igual i es diu en una línia.
    inbox,
  ] = await Promise.all([
      listReservationsInRange({ from, to, trainerId: agendaOf }),
      listTrainers(),
      trainerId ? listClients(trainerId) : Promise.resolve([]),
      listAllTrainerRulesLite(),
      listAllBlocksLite(from),
      listActiveTrialHolds({ from, to }),
      getColorPalette(),
      trainerId ? listOwnBlocksInRange({ trainerId, from, to }) : Promise.resolve([]),
      trainerId
        ? countWaitingForTrainer({
            trainerId,
            fromDay: centerDateStr(from),
            toDay: centerDateStr(to),
          }).catch(() => [])
        : Promise.resolve([]),
      trainerId
        ? getTrainerInbox({
            trainerId,
            trials: centerSettings.modules.sessionsProva,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

  // L'entrenador només gestiona (accepta/rebutja) les proves que són seves.
  const manageableTrialIds = trials
    .filter((t) => t.trainerId === trainerId)
    .map((t) => t.id);

  const myClientIds = new Set(myClients.map((c) => c.id));
  const manageableIds = reservations
    .filter((r) => myClientIds.has(r.clientId))
    .map((r) => r.id);

  // «Demo amb demo» també aquí: les portes de la 0107 obren grups de tot el
  // centre. El món demo surt de `demo_profiles`.
  const world = await getDemoWorld();
  const sameWorld = (r: (typeof reservations)[number]) =>
    !!trainerId && demoCompatible(world, r.clientId, trainerId);

  // Cancel·lar (0091 + 0107): els seus clients, la SEVA agenda (qui fa la
  // sessió és qui sap si la podrà fer) i qualsevol plaça de GRUP del centre.
  const cancellableIds = reservations
    .filter(
      (r) =>
        myClientIds.has(r.clientId) ||
        (sameWorld(r) && (r.trainerId === trainerId || r.serviceType === "grupo_reducido")),
    )
    .map((r) => r.id);

  // Marcar feta (0107, `complete_reservation`): els seus clients i la seva
  // agenda. Ho necessita qui reserva la seva especialitat a clients d'altres:
  // la sessió que fa ell, la marca ell (i la liquidació la compta per a ell).
  const completableIds = reservations
    .filter((r) => myClientIds.has(r.clientId) || (sameWorld(r) && r.trainerId === trainerId))
    .map((r) => r.id);

  // Reprogramar: la mateixa regla que reservar (`staffBookingScope`), sense
  // cortesia: moure una sessió no en regala cap.
  const reschedulableIds = reservations
    .filter(
      (r) =>
        !!trainerId &&
        sameWorld(r) &&
        staffBookingScope({
          isOwnClient: myClientIds.has(r.clientId),
          serviceType: r.serviceType,
          trainerId: r.trainerId,
          viewerId: trainerId,
          viewerSpecialty: viewer?.specialty ?? null,
          courtesy: false,
        }) === "ok",
    )
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

  // Només les passades: són les úniques on la nota té sentit i on es pinta.
  const nowISO = new Date().toISOString();
  const { notes: noteMap, failed: notesFailed } = await getNotesForReservations(
    reservations.filter((r) => r.scheduledAt <= nowISO).map((r) => r.id),
  );
  const notes = Object.fromEntries(noteMap);

  return (
    <>
      <main className="mx-auto max-w-5xl px-4 pt-3 pb-6 md:p-6">
        <GroupTabs tabs={TABS} className="mb-2 md:mb-5" />
        {/* Al mòbil, una sola fila: el calendari ha de començar tan amunt com
            es pugui. La descripció només a l'ordinador (també és al manual). */}
        <div className="mb-3 flex items-center justify-between gap-2 md:mb-6 md:gap-4">
          <div>
            <h1 className="text-2xl text-brand-dark">Reserves</h1>
            <p className="mt-1 hidden text-sm text-brand-muted md:block">
              Veus l&apos;agenda completa del centre. Gestiones les reserves
              dels teus clients, i a més pots apuntar qualsevol client a un
              grup o a la teva especialitat a la teva agenda.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SupportInlineButton />
            <Link
              href="/trainer/reservas/new"
              className={`inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark md:h-10 ${TAP}`}
            >
              + Nova<span className="hidden sm:inline">&nbsp;reserva</span>
            </Link>
          </div>
        </div>

        {inbox ? (
          <CalFerTray
            inbox={inbox}
            palette={palette}
            clientBase="/trainer/clients"
            cancelAction={cancelTrainerReservationAction}
            completeAction={completeTrainerReservationAction}
            rescheduleAction={rescheduleTrainerReservationAction}
            acceptTrialAction={acceptTrialTrainerAction}
            rejectTrialAction={rejectTrialTrainerAction}
          />
        ) : (
          trainerId && (
            <p role="status" className="mb-3 text-sm text-error">
              No s&apos;ha pogut carregar «Cal fer». L&apos;agenda és al dia.
            </p>
          )
        )}

        <ReservationsView
          nav={nav}
          notesFailed={notesFailed}
          palette={palette}
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          clientBase="/trainer/clients"
          manageableIds={manageableIds}
          completableIds={completableIds}
          reschedulableIds={reschedulableIds}
          cancellableIds={cancellableIds}
          notes={notes}
          noteableIds={noteableIds}
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
          calendar="trainer"
          ownBlocks={ownBlocks}
          createFromSlotAction={createFromSlotAction}
          searchClients={searchClientsAction}
          waiting={waiting}
          openingHour={centerSettings.openingHour}
          closingHour={centerSettings.closingHour}
        />
      </main>
    </>
  );
}
