import Link from "next/link";
import { TAP } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Empty, Panel, PANEL_ACTION, Row } from "@/components/client-file/panel";
import { BonosSummaryCard, NotesCard, TrainingCard, UpcomingSessionsCard } from "@/components/client-file/resum";
import { SessionsList } from "@/components/client-file/sessions";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { ClientNotesPanel } from "@/components/client-notes-panel";
import { ClientTagsPanel } from "@/components/client-tags-panel";
import { AssignTrainerForm } from "@/components/forms/assign-trainer-form";
import { getClient, listTrainers, type ClientBono } from "@/lib/data/clients";
import { getAnyLiveSubscription } from "@/lib/data/subscriptions";
import { countCenterCollectableBonos } from "@/lib/data/bonos";
import { cancelBlockFor } from "@/lib/bono-rules";
import { CollectableBonosAnnouncer } from "@/components/collectable-bonos-announcer";
import { MarkBonoPaidButton } from "@/components/forms/mark-bono-paid-button";
import { CancelBonoButton } from "@/components/forms/cancel-bono-button";
import { markBonoPaidAction, cancelBonoAction } from "@/app/(admin)/admin/bonos/actions";
import { ClientBonoList, SubscriptionCard } from "@/components/client-file/bonos";
import { centerToday } from "@/lib/center-time";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listClientTags, listTagsOfClient } from "@/lib/data/client-tags";
import { listExercises } from "@/lib/data/exercises";
import { getConsentStatus } from "@/lib/data/consents";
import { listClientDocuments } from "@/lib/data/client-documents";
import { listAllProgressForClient } from "@/lib/data/exercise-progress";
import { DocumentsReadonlyPanel } from "@/components/documents-readonly-panel";
import { ClientFileHeader } from "@/components/client-file/header";
import {
  ClientFileMenu,
  TagsEditor,
  TrainerLine,
} from "@/components/client-file/header-parts";
import { AssignedExercisesPanel } from "@/components/assigned-exercises-panel";
import { ClientProgressPanel } from "@/components/client-progress-panel";
import {
  NextSessionReminderButton,
  NotifyNewExercisesButton,
} from "@/components/client-notify-buttons";
import {
  assignExerciseAction,
  removeExerciseAction,
} from "@/app/(admin)/admin/clients/exercises-actions";
import {
  toggleClientTagAction,
  createAndAssignTagAction,
} from "@/app/(admin)/admin/etiquetes/actions";
import {
  PAYMENT_METHOD_LABELS,
  formatEur,
  formatDate,
} from "@/lib/labels";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // El consentiment depèn de la fitxa (en necessita el perfil), però no de la
  // resta: s'hi encadena i viatja en la mateixa tanda, en comptes d'esperar
  // que acabi tot per començar.
  const clientPromise = getClient(id);
  const consentPromise = clientPromise.then((c) =>
    c ? getConsentStatus(c.profileId) : null,
  );
  const [
    client,
    assignedExercises,
    library,
    documents,
    allProgress,
    allTags,
    clientTags,
    trainers,
    subscription,
    centerCollectable,
    consent,
  ] = await Promise.all([
    clientPromise,
    listClientExercises(id),
    listExercises(),
    listClientDocuments(id),
    listAllProgressForClient(id),
    listClientTags(),
    listTagsOfClient(id),
    listTrainers(),
    getAnyLiveSubscription(id),
    // Per a la piloteta de «Bons i pagaments» del menú, com a la fitxa del
    // professional. Si falla, no s'anuncia res.
    countCenterCollectableBonos().catch(() => null),
    consentPromise,
  ]);
  if (!client || !consent) notFound();

  const receivesFisio =
    client.bonos.some((b) => b.serviceType === "fisioterapia") ||
    client.reservations.some((r) => r.serviceType === "fisioterapia");
  const needsHealthConsent = receivesFisio && !consent.healthDataAt;

  const redirectPath = `/admin/clients/${id}`;
  // El dia i l'instant del CENTRE, decidits al servidor: quines sessions són
  // properes i quins bons han passat de data.
  const today = centerToday();
  const now = new Date().toISOString();
  const assignedTagIds = new Set(clientTags.map((t) => t.id));

  /*
    COBRAR I ANUL·LAR DES DE LA FITXA, com a la taula de Bons: les mateixes
    accions de l'admin (`markBonoPaidAction`, `cancelBonoAction` amb
    `isAdmin: true`) i els mateixos diàlegs, que demanen confirmació. Qui pot
    anul·lar què ho decideix `cancelBlockFor`, no aquesta pàgina.

    Al Resum (`summary`) només surten als bons per cobrar: un «Anul·lar» a cada
    bo actiu, a la primera pantalla, seria una acció destructiva i rara a la
    vista de tothom. A «Bons i pagaments» hi són tots, com a la taula.
  */
  const bonoActions = (b: ClientBono, summary: boolean) => {
    const canPay = b.status === "pending_payment" || b.status === "unpaid";
    if (summary && !canPay) return null;
    const canCancel =
      cancelBlockFor(
        {
          status: b.status,
          remainingSessions: b.remainingSessions,
          totalSessions: b.totalSessions,
          subscriptionId: b.subscriptionId,
        },
        true,
      ) === null;
    if (!canPay && !canCancel) return null;
    return (
      <>
        {canCancel && (
          <CancelBonoButton
            action={cancelBonoAction}
            bonoId={b.id}
            serviceType={b.serviceType}
            price={b.price}
            totalSessions={b.totalSessions}
            status={b.status}
          />
        )}
        {canPay && (
          <MarkBonoPaidButton
            admin
            action={markBonoPaidAction}
            bonoId={b.id}
            serviceType={b.serviceType}
            price={b.price}
            remainingSessions={b.remainingSessions}
            totalSessions={b.totalSessions}
            status={b.status}
            expired={!!b.expiresAt && b.expiresAt < today}
          />
        )}
      </>
    );
  };

  const tabs = [
    {
      label: "Resum",
      content: (
        <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-4">
            <BonosSummaryCard
              bonos={client.bonos}
              today={today}
              addHref={`/admin/clients/${client.id}/bonos/new`}
              actions={(b) => bonoActions(b, true)}
            />
            <UpcomingSessionsCard
              reservations={client.reservations}
              now={now}
              clientId={client.id}
              newHref={`/admin/reservas/new?client=${client.id}${client.assignedTrainerId ? `&trainer=${client.assignedTrainerId}` : ""}`}
            />
          </div>
          <div className="flex flex-col gap-4">
            <NotesCard
              clinicalNotes={client.clinicalNotes}
              generalNotes={client.generalNotes}
              editHref={`/admin/clients/${client.id}/edit`}
            />
            <TrainingCard assigned={assignedExercises} progress={allProgress} />
          </div>
        </div>
      ),
    },
    {
      label: "Bons i pagaments",
      content: (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">Bons</h2>
              <Link href={`/admin/clients/${client.id}/bonos/new`} className={`${PANEL_ACTION} ${TAP}`}>
                + Afegir bo
              </Link>
            </div>
            {subscription && <SubscriptionCard sub={subscription} />}
            <ClientBonoList bonos={client.bonos} today={today} actions={(b) => bonoActions(b, false)} />
          </section>
          <Panel title="Pagaments">
            {client.payments.length === 0 ? (
              <Empty>Sense pagaments.</Empty>
            ) : (
              client.payments
                .slice()
                .sort((x, y) => y.paidAt.localeCompare(x.paidAt))
                .map((p) => (
                  <Row key={p.id}>
                    <span className="font-bold text-brand-dark">{formatDate(p.paidAt)}</span>
                    <span className="font-bold tabular-nums">{formatEur(p.amount)}</span>
                    <Badge tone="neutral" icon={p.method === "card" ? "card" : "cash"}>
                      {PAYMENT_METHOD_LABELS[p.method]}
                    </Badge>
                  </Row>
                ))
            )}
          </Panel>
        </div>
      ),
    },
    {
      label: "Sessions",
      content: (
        <div className="flex flex-col gap-4">
          <Panel
            title="Sessions"
            action={
              <Link
                href={`/admin/reservas/new?client=${client.id}${client.assignedTrainerId ? `&trainer=${client.assignedTrainerId}` : ""}`}
                className={`${PANEL_ACTION} ${TAP}`}
              >
                + Nova reserva
              </Link>
            }
          >
            <SessionsList reservations={client.reservations} now={now} />
          </Panel>
          <NextSessionReminderButton clientId={client.id} />
        </div>
      ),
    },
    {
      label: "Entrenament",
      content: (
        <div className="flex flex-col gap-6">
          <AssignedExercisesPanel
            assigned={assignedExercises}
            library={library}
            canManage
            assignAction={assignExerciseAction.bind(null, client.id)}
            removeAction={removeExerciseAction.bind(null, client.id)}
          />
          <NotifyNewExercisesButton clientId={client.id} />
          <ClientProgressPanel
            assigned={assignedExercises}
            allProgress={allProgress}
            canManage
            redirectPath={redirectPath}
          />
        </div>
      ),
    },
    {
      label: "Notes i documents",
      content: (
        <div className="flex flex-col gap-6">
          <ClientNotesPanel
            clinicalNotes={client.clinicalNotes}
            generalNotes={client.generalNotes}
            editHref={`/admin/clients/${client.id}/edit`}
          />
          <DocumentsReadonlyPanel documents={documents} clientId={id} />
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <ClientFileHeader
        backHref="/admin/clients"
        fullName={client.fullName}
        email={client.email}
        phone={client.phone}
        trainerLine={
          /*
            Assignar el professional es fa a la mateixa fitxa i no dins
            d'«Editar»: aquell formulari desa de cop nom, correu, telèfon i
            les notes clíniques, i obrir-lo per canviar un desplegable era
            passar per sobre de dades de salut per a res.
          */
          <TrainerLine
            trainerName={client.trainerName}
            form={
              <AssignTrainerForm
                clientId={client.id}
                trainers={trainers}
                currentTrainerId={client.assignedTrainerId}
                label="Professional assignat/da"
              />
            }
          />
        }
        tags={clientTags}
        tagsEditor={
          <TagsEditor hasTags={clientTags.length > 0}>
            <ClientTagsPanel
              allTags={allTags}
              assignedIds={assignedTagIds}
              toggleAction={toggleClientTagAction.bind(null, id, redirectPath)}
              createAction={createAndAssignTagAction.bind(null, id, redirectPath)}
              canAssign
              canCreate
            />
          </TagsEditor>
        }
        menu={
          <ClientFileMenu
            clientId={client.id}
            clientName={client.fullName}
            editHref={`/admin/clients/${client.id}/edit`}
            exportHref={`/admin/clients/${client.id}/export`}
            canDelete
          />
        }
        needsHealthConsent={needsHealthConsent}
      />

      {/*
        Aquí també es cobra i s'anul·la: la piloteta del menú es posa al dia
        amb el recompte del centre cada cop que la pàgina es torna a pintar.
      */}
      {centerCollectable !== null && <CollectableBonosAnnouncer count={centerCollectable} />}
      <InPageTabs tabs={tabs} ariaLabel="Seccions de la fitxa" />
    </main>
  );
}
