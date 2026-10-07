import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientNotesPanel } from "@/components/client-notes-panel";
import { getViewer } from "@/lib/auth";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { getClient, listTrainers, type ClientBono } from "@/lib/data/clients";
import { ClientBonoList } from "@/components/client-file/bonos";
import { AssignTrainerForm } from "@/components/forms/assign-trainer-form";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listClientTags, listTagsOfClient } from "@/lib/data/client-tags";
import { ClientTagsPanel } from "@/components/client-tags-panel";
import { listExercises } from "@/lib/data/exercises";
import { listClientDocuments } from "@/lib/data/client-documents";
import { listAllProgressForClient } from "@/lib/data/exercise-progress";
import { DocumentsReadonlyPanel } from "@/components/documents-readonly-panel";
import { getConsentStatus } from "@/lib/data/consents";
import { ClientFileHeader } from "@/components/client-file/header";
import {
  ClientFileMenu,
  TagsEditor,
  TrainerLine,
} from "@/components/client-file/header-parts";
import { Panel, PANEL_ACTION } from "@/components/client-file/panel";
import { BonosSummaryCard, NotesCard, TrainingCard, UpcomingSessionsCard } from "@/components/client-file/resum";
import { SessionsList } from "@/components/client-file/sessions";
import { AssignedExercisesPanel } from "@/components/assigned-exercises-panel";
import { ClientProgressPanel } from "@/components/client-progress-panel";
import {
  NextSessionReminderButton,
  NotifyNewExercisesButton,
} from "@/components/client-notify-buttons";
import {
  assignExerciseTrainerAction,
  removeExerciseTrainerAction,
} from "@/app/(trainer)/trainer/clients/exercises-actions";
import {
  markTrainerBonoPaidAction,
  cancelTrainerBonoAction,
} from "@/app/(trainer)/trainer/bonos/actions";
import { MarkBonoPaidButton } from "@/components/forms/mark-bono-paid-button";
import { CancelBonoButton } from "@/components/forms/cancel-bono-button";
import { cancelBlockFor } from "@/lib/bono-rules";
import { countCenterCollectableBonos } from "@/lib/data/bonos";
import { CollectableBonosAnnouncer } from "@/components/collectable-bonos-announcer";
import { toggleClientTagAction } from "@/app/(admin)/admin/etiquetes/actions";
import { centerToday } from "@/lib/center-time";
import { TAP } from "@/lib/utils";
import type { BonoStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TrainerClientDetailPage({
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
    viewer,
    client,
    assignedExercises,
    library,
    documents,
    allProgress,
    trainers,
    allTags,
    clientTags,
    centerCollectable,
    consent,
  ] = await Promise.all([
    getViewer(),
    clientPromise,
    listClientExercises(id),
    listExercises(),
    listClientDocuments(id),
    listAllProgressForClient(id),
    listTrainers(),
    listClientTags(),
    listTagsOfClient(id),
    // Per a la piloteta de «Bons» del menú: vegeu l'anunciador de sota. Si
    // falla, no s'anuncia res —millor el número d'abans que un zero inventat.
    countCenterCollectableBonos().catch(() => null),
    consentPromise,
  ]);
  if (!client || !consent) notFound();

  const canManage = !!viewer && client.assignedTrainerId === viewer.id;

  const receivesFisio =
    client.bonos.some((b) => b.serviceType === "fisioterapia") ||
    client.reservations.some((r) => r.serviceType === "fisioterapia");
  const needsHealthConsent = receivesFisio && !consent.healthDataAt;

  // Les dues accions sobre un bo, amb la mateixa regla que les taules. Cap de
  // les dues mira `canManage`: vegeu el comentari de `bonoActions`.
  const canCollect = (b: { status: string }) =>
    b.status === "pending_payment" || b.status === "unpaid";
  const canCancelBono = (b: {
    status: BonoStatus;
    remainingSessions: number;
    totalSessions: number;
    subscriptionId: string | null;
  }) =>
    cancelBlockFor(
      {
        status: b.status,
        remainingSessions: b.remainingSessions,
        totalSessions: b.totalSessions,
        subscriptionId: b.subscriptionId,
      },
      false,
    ) === null;

  const redirectPath = `/trainer/clients/${id}`;
  const assignedTagIds = new Set(clientTags.map((t) => t.id));
  // El dia del CENTRE: decideix si un bo decaigut ja ha passat de data, i amb
  // això quin dels dos textos ensenya el diàleg de cobrament.
  const today = centerToday();
  const now = new Date().toISOString();

  /*
    CAP DELS DOS BOTONS VA LLIGAT A `canManage`, i és a posta.

    Des de la 0085, cobrar un bo no depèn de qui tingui el client assignat: qui
    el té al davant amb els diners a la mà no sempre és qui el té assignat.
    Anul·lar tampoc, però sí que té sostre —un bo ja cobrat és de l'admin—, i
    això ho decideix `cancelBlockFor`, no aquesta fitxa.

    Són els mateixos components que fa servir la taula de Bons, amb els seus
    diàlegs. Sense nom de client a posta: som dins de la seva fitxa. Al Resum
    (`summary`), només als bons per cobrar.
  */
  const bonoActions = (b: ClientBono, summary: boolean) => {
    const pay = canCollect(b);
    if (summary && !pay) return null;
    const cancel = canCancelBono(b);
    if (!pay && !cancel) return null;
    return (
      <>
        {cancel && (
          <CancelBonoButton
            action={cancelTrainerBonoAction}
            bonoId={b.id}
            serviceType={b.serviceType}
            price={b.price}
            totalSessions={b.totalSessions}
            status={b.status}
          />
        )}
        {pay && (
          <MarkBonoPaidButton
            action={markTrainerBonoPaidAction}
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
              addHref={canManage ? `/trainer/bonos/new?clientId=${client.id}` : undefined}
              actions={(b) => bonoActions(b, true)}
            />
            <UpcomingSessionsCard
              reservations={client.reservations}
              now={now}
              clientId={client.id}
              newHref={canManage ? `/trainer/reservas/new?client=${client.id}` : undefined}
            />
          </div>
          <div className="flex flex-col gap-4">
            <NotesCard clinicalNotes={client.clinicalNotes} generalNotes={client.generalNotes} />
            <TrainingCard assigned={assignedExercises} progress={allProgress} />
          </div>
        </div>
      ),
    },
    {
      // Sense pagaments ni subscripció: el professional no en veu els imports
      // (decisió P2, igual que abans).
      label: "Bons i pagaments",
      content: (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">Bons</h2>
            {canManage && (
              <Link href={`/trainer/bonos/new?clientId=${client.id}`} className={`${PANEL_ACTION} ${TAP}`}>
                + Afegir bo
              </Link>
            )}
          </div>
          <ClientBonoList bonos={client.bonos} today={today} actions={(b) => bonoActions(b, false)} />
        </section>
      ),
    },
    {
      label: "Sessions",
      content: (
        <div className="flex flex-col gap-4">
          <Panel
            title="Sessions"
            action={
              canManage && (
                <Link href={`/trainer/reservas/new?client=${client.id}`} className={`${PANEL_ACTION} ${TAP}`}>
                  + Nova reserva
                </Link>
              )
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
            canManage={canManage}
            assignAction={assignExerciseTrainerAction.bind(null, client.id)}
            removeAction={removeExerciseTrainerAction.bind(null, client.id)}
          />
          <NotifyNewExercisesButton clientId={client.id} />
          <ClientProgressPanel
            assigned={assignedExercises}
            allProgress={allProgress}
            canManage={canManage}
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
          />
          <DocumentsReadonlyPanel documents={documents} clientId={id} />
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <ClientFileHeader
        backHref="/trainer/clients"
        fullName={client.fullName}
        email={client.email}
        phone={client.phone}
        trainerLine={
          /*
            Reassignar no va lligat a `canManage`: qualsevol professional pot
            moure qualsevol client, també un que ara mateix no és seu. És el
            cas per al qual es va fer —cobrir una baixa, repartir-se l'agenda—
            i qui mana de veritat és la comprovació de rol de l'acció.
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
          // Assignar sí, crear no: el catàleg és de l'admin (RLS de la 0068).
          // I només si el client és seu, com la resta de la fitxa.
          canManage ? (
            <TagsEditor hasTags={clientTags.length > 0}>
              <ClientTagsPanel
                allTags={allTags}
                assignedIds={assignedTagIds}
                toggleAction={toggleClientTagAction.bind(null, id, redirectPath)}
                canAssign
                canCreate={false}
              />
            </TagsEditor>
          ) : undefined
        }
        menu={<ClientFileMenu clientId={client.id} clientName={client.fullName} />}
        notice={
          /*
            Abans era una píndola «Només consulta · pots cobrar-li bons», que a
            375 px feia tres línies al costat del nom. Ara és una frase: de qui
            és, i què hi pots fer. Des de la 0085 es pot cobrar i anul·lar un bo
            pendent encara que el client no sigui seu.
          */
          !canManage && (
            <p className="rounded-xl border border-brand-border bg-neutral-bg px-3.5 py-2.5 text-sm text-neutral-ink">
              {client.trainerName ? (
                <>
                  Client de <b className="font-bold">{client.trainerName}</b>.
                </>
              ) : (
                "Client sense professional assignat."
              )}{" "}
              Pots consultar-ho tot i cobrar-li bons; la resta, el seu professional.
            </p>
          )
        }
        needsHealthConsent={needsHealthConsent}
      />

      {/*
        Aquí també es cobra i s'anul·la, i la piloteta del menú ho ha de saber.
        No n'hi ha prou amb el `revalidatePath` de l'acció: sí que torna a pintar
        el layout amb el número nou, però si abans s'havia passat per Bons el
        magatzem ja té valor i mana ell —comprovat: es quedava amb el d'abans—.
        Aquesta pàgina només veu els bons d'un client, per això el número del
        centre es compta a part: una consulta `count`, només aquí.
      */}
      {centerCollectable !== null && (
        <CollectableBonosAnnouncer count={centerCollectable} />
      )}
      <InPageTabs tabs={tabs} ariaLabel="Seccions de la fitxa" />
    </main>
  );
}
