import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientNotesPanel } from "@/components/client-notes-panel";
import { getViewer } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { getClient, listTrainers } from "@/lib/data/clients";
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
import { Empty, Info, Panel, PANEL_ACTION, Row } from "@/components/client-file/panel";
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
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  formatEur,
  formatDate,
} from "@/lib/labels";
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
  // les dues mira `canManage`: vegeu el comentari de la pestanya Bons.
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

  const tabs = [
    {
      label: "Resum",
      content: (
        <div className="flex flex-col gap-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <Info label="Bons actius" value={String(client.activeBonos)} />
            <Info label="Sessions restants" value={String(client.remainingSessions)} />
          </section>
          {(client.clinicalNotes || client.generalNotes) && (
            <ClientNotesPanel
              clinicalNotes={client.clinicalNotes}
              generalNotes={client.generalNotes}
            />
          )}
        </div>
      ),
    },
    {
      // Sense pagaments: el professional no els veu (decisió P2, igual que abans).
      label: "Bons i pagaments",
      content: (
        <Panel
          title="Bons"
          action={
            canManage && (
              <Link href={`/trainer/bonos/new?clientId=${client.id}`} className={`${PANEL_ACTION} ${TAP}`}>
                + Afegir bo
              </Link>
            )
          }
        >
          {client.bonos.length === 0 ? (
            <Empty>Sense bons.</Empty>
          ) : (
            client.bonos.map((b) => (
              <Row key={b.id}>
                <span className="font-bold text-brand-dark">
                  {SERVICE_LABELS[b.serviceType]}
                </span>
                <span className="text-brand-muted">
                  {b.remainingSessions} / {b.totalSessions} sessions
                </span>
                <span>{formatEur(b.price)}</span>
                <Badge
                  icon={b.status === "pending_payment" ? "pending" : undefined}
                  tone={
                    b.status === "active"
                      ? "success"
                      : b.status === "pending_payment"
                        ? "attention"
                        : // Decaigut i caducat no són neutrals com "completat":
                          // hi ha sessions pagades que s'han perdut. Mateix
                          // criteri que les dues taules de bons.
                          b.status === "unpaid" || b.status === "expired"
                          ? "danger"
                          : "neutral"
                  }
                >
                  {BONO_STATUS_LABELS[b.status]}
                </Badge>
                {/*
                  CAP DELS DOS BOTONS VA LLIGAT A `canManage`, i és a posta.

                  Des de la 0085, cobrar un bo no depèn de qui tingui el client
                  assignat: qui el té al davant amb els diners a la mà no sempre
                  és qui el té assignat. Anul·lar tampoc, però sí que té sostre
                  —un bo ja cobrat és de l'admin—, i això ho decideix
                  `cancelBlockFor`, no aquesta fitxa.

                  El que segueix lligat a `canManage` és la resta: afegir un bo,
                  crear reserves, assignar exercicis i posar etiquetes.

                  Són els mateixos components que fa servir la taula de
                  l'administració, amb els seus diàlegs. Sense nom de client a
                  posta: som dins de la seva fitxa.
                */}
                {(canCollect(b) || canCancelBono(b)) && (
                  <span className="ml-auto flex items-center gap-2">
                    {canCollect(b) && (
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
                    {canCancelBono(b) && (
                      <CancelBonoButton
                        action={cancelTrainerBonoAction}
                        bonoId={b.id}
                        serviceType={b.serviceType}
                        price={b.price}
                        totalSessions={b.totalSessions}
                        status={b.status}
                      />
                    )}
                  </span>
                )}
              </Row>
            ))
          )}
        </Panel>
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
                <Link href="/trainer/reservas/new" className={`${PANEL_ACTION} ${TAP}`}>
                  + Nova reserva
                </Link>
              )
            }
          >
            {client.reservations.length === 0 ? (
              <Empty>Sense reserves.</Empty>
            ) : (
              client.reservations.map((r) => (
                <Row key={r.id}>
                  <span className="font-bold text-brand-dark">{formatDate(r.scheduledAt)}</span>
                  <span className="text-brand-muted">{SERVICE_LABELS[r.serviceType]}</span>
                  <Badge tone={r.status === "completed" ? "success" : "info"}>
                    {RESERVATION_STATUS_LABELS[r.status]}
                  </Badge>
                </Row>
              ))
            )}
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
            Abans era una píldora «Només consulta · pots cobrar-li bons», que a
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
