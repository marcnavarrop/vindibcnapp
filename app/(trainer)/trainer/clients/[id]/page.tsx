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
import { markTrainerBonoPaidAction } from "@/app/(trainer)/trainer/bonos/actions";
import { toggleClientTagAction } from "@/app/(admin)/admin/etiquetes/actions";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatEur,
  formatDate,
} from "@/lib/labels";

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
  ]);
  if (!client) notFound();

  const canManage = !!viewer && client.assignedTrainerId === viewer.id;

  const consent = await getConsentStatus(client.profileId);
  const receivesFisio =
    client.bonos.some((b) => b.serviceType === "fisioterapia") ||
    client.reservations.some((r) => r.serviceType === "fisioterapia");
  const needsHealthConsent = receivesFisio && !consent.healthDataAt;

  const redirectPath = `/trainer/clients/${id}`;
  const assignedTagIds = new Set(clientTags.map((t) => t.id));

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
                className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
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
                        : "neutral"
                  }
                >
                  {BONO_STATUS_LABELS[b.status]}
                </Badge>
                {/*
                  Només per als clients propis: `canManage` és la mateixa
                  condició que deixa afegir-los un bo, i la RLS de la 0056 la
                  torna a comprovar a la base.
                */}
                {canManage && b.status === "pending_payment" && (
                  <form action={markTrainerBonoPaidAction} className="ml-auto">
                    <input type="hidden" name="bonoId" value={b.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-brand-purple px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-purple-light"
                    >
                      Marcar com pagat
                    </button>
                  </form>
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
                className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
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
            className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
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
              {clientTags.map((t) => (
                <Badge key={t.id} tone="info">
                  {t.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {!canManage && (
          <span className="rounded-full bg-brand-muted/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
            Només lectura
          </span>
        )}
      </div>

      {needsHealthConsent && <HealthConsentWarning />}

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
