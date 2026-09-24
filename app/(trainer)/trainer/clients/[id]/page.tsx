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
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { listExercises } from "@/lib/data/exercises";
import { listClientDocuments } from "@/lib/data/client-documents";
import { listAllProgressForClient } from "@/lib/data/exercise-progress";
import { DocumentsReadonlyPanel } from "@/components/documents-readonly-panel";
import { getConsentStatus } from "@/lib/data/consents";
import { HealthConsentWarning } from "@/components/health-consent-warning";
import { AssignedExercisesPanel } from "@/components/assigned-exercises-panel";
import { ClientProgressPanel } from "@/components/client-progress-panel";
import { ClientNotificationsPanel } from "@/components/client-notifications-panel";
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
  ] = await Promise.all([
    getViewer(),
    getClient(id),
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
  ]);
  if (!client) notFound();

  const canManage = !!viewer && client.assignedTrainerId === viewer.id;

  const consent = await getConsentStatus(client.profileId);
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
          <section className="grid gap-4 sm:grid-cols-3">
            {/*
              Reassignar no va lligat a `canManage`: qualsevol professional pot
              moure qualsevol client, també un que ara mateix no és seu. És el
              cas per al qual es va fer —cobrir una baixa, repartir-se l'agenda—
              i qui mana de veritat és la comprovació de rol de l'acció.
            */}
            <div className="rounded-2xl border border-brand-border bg-white p-5">
              <AssignTrainerForm
                clientId={client.id}
                trainers={trainers}
                currentTrainerId={client.assignedTrainerId}
              />
            </div>
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
      label: "Bonos",
      content: (
        <Panel
          title="Bons"
          action={
            canManage && (
              <Link
                href={`/trainer/bonos/new?clientId=${client.id}`}
                className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
              >
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
                  tone={
                    b.status === "active"
                      ? "success"
                      : b.status === "pending_payment"
                        ? "warn"
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
      label: "Reserves",
      content: (
        <Panel
          title="Reserves"
          action={
            canManage && (
              <Link
                href="/trainer/reservas/new"
                className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
              >
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
                <span className="font-bold text-brand-dark">
                  {formatDate(r.scheduledAt)}
                </span>
                <span className="text-brand-muted">
                  {SERVICE_LABELS[r.serviceType]}
                </span>
                <Badge tone={r.status === "completed" ? "success" : "info"}>
                  {RESERVATION_STATUS_LABELS[r.status]}
                </Badge>
              </Row>
            ))
          )}
        </Panel>
      ),
    },
    {
      label: "Exercicis",
      content: (
        <AssignedExercisesPanel
          assigned={assignedExercises}
          library={library}
          canManage={canManage}
          assignAction={assignExerciseTrainerAction.bind(null, client.id)}
          removeAction={removeExerciseTrainerAction.bind(null, client.id)}
        />
      ),
    },
    {
      label: "Progrés",
      content: (
        <ClientProgressPanel
          assigned={assignedExercises}
          allProgress={allProgress}
          canManage={canManage}
          redirectPath={redirectPath}
        />
      ),
    },
    {
      label: "Documents",
      content: <DocumentsReadonlyPanel documents={documents} clientId={id} />,
    },
    {
      label: "Etiquetes",
      content: (
        <ClientTagsPanel
          allTags={allTags}
          assignedIds={assignedTagIds}
          toggleAction={toggleClientTagAction.bind(null, id, redirectPath)}
          // Assignar sí, crear no: el catàleg és de l'admin (RLS de la 0068).
          // I només si el client és seu, com la resta de la fitxa.
          canAssign={canManage}
          canCreate={false}
        />
      ),
    },
    {
      label: "Notes",
      content: (
        <ClientNotesPanel
          clinicalNotes={client.clinicalNotes}
          generalNotes={client.generalNotes}
        />
      ),
    },
    {
      label: "Notificacions",
      content: (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-brand-muted">
            Envia avisos manuals a aquest client.
          </p>
          <ClientNotificationsPanel clientId={client.id} />
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/trainer/clients"
            className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
          >
            ← Clients
          </Link>
          <h1 className="mt-1 text-2xl text-brand-dark">{client.fullName}</h1>
          {/*
            El botó va aquí, a la mateixa línia que el correu i el telèfon, i
            no entre les accions de la dreta: contactar és una dada de
            contacte, no una operació sobre la fitxa. Si no hi ha telèfon no es
            pinta —igual que el telèfon mateix, que tampoc surt.
          */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-muted">
            <span>
              {client.email}
              {client.phone ? ` · ${client.phone}` : ""}
            </span>
            <WhatsAppLink phone={client.phone} name={client.fullName} />
          </p>
          {clientTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {/*
                L'únic Badge amb text que no controlem: el nom de l'etiqueta
                l'escriu l'admin i no té sostre. Amb el `whitespace-nowrap` de
                la base, un nom llarg se'n sortiria d'aquesta fila en comptes de
                partir-se, així que aquí es talla amb punts suspensius i el nom
                sencer queda al `title`.
              */}
              {clientTags.map((t) => (
                <Badge
                  key={t.id}
                  tone="info"
                  className="max-w-full truncate"
                  title={t.name}
                >
                  {t.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {/*
          Ja no diu "Només lectura", perquè deixaria de ser veritat: des de la
          0085 aquesta fitxa té botons que funcionen —cobrar-li un bo, i
          anul·lar-n'hi un de pendent— encara que el client no sigui seu. Un
          segell que contradiu els botons que té a sota fa dubtar de tots dos.
        */}
        {!canManage && (
          <span className="rounded-full bg-brand-muted/10 px-3 py-1 text-center text-xs font-bold tracking-wide text-brand-muted uppercase">
            Només consulta · pots cobrar-li bons
          </span>
        )}
      </div>

      {needsHealthConsent && <HealthConsentWarning />}

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
      <InPageTabs tabs={tabs} />
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-5">
      <div className="text-xs font-bold tracking-wide text-brand-muted uppercase">{label}</div>
      <div className="mt-1 text-lg font-bold text-brand-dark">{value}</div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-brand-border">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-3 text-sm text-brand-muted">{children}</p>;
}
