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
import { getClient, listTrainers } from "@/lib/data/clients";
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
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
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

  const tabs = [
    {
      label: "Resum",
      content: (
        <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-4">
            <BonosSummaryCard bonos={client.bonos} today={today} addHref={`/admin/clients/${client.id}/bonos/new`} />
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
          <Panel
            title="Bons"
            action={
              <Link href={`/admin/clients/${client.id}/bonos/new`} className={`${PANEL_ACTION} ${TAP}`}>
                + Afegir bo
              </Link>
            }
          >
            {client.bonos.length === 0 ? (
              <Empty>Sense bons.</Empty>
            ) : (
              client.bonos.map((b) => (
                <Row key={b.id}>
                  <span className="font-bold text-brand-dark">{SERVICE_LABELS[b.serviceType]}</span>
                  <span className="text-brand-muted">
                    {b.remainingSessions} / {b.totalSessions} sessions
                  </span>
                  <span>{formatEur(b.price)}</span>
                  {b.expiresAt && (
                    <span className="text-xs text-brand-muted">
                      {b.status === "expired" ? "va caducar" : "caduca"} el {formatDate(b.expiresAt)}
                    </span>
                  )}
                  <Badge
                    tone={
                      b.status === "active"
                        ? "success"
                        : b.status === "expired" || b.status === "unpaid"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {BONO_STATUS_LABELS[b.status]}
                  </Badge>
                </Row>
              ))
            )}
          </Panel>
          <Panel title="Pagaments">
            {client.payments.length === 0 ? (
              <Empty>Sense pagaments.</Empty>
            ) : (
              client.payments.map((p) => (
                <Row key={p.id}>
                  <span className="font-bold text-brand-dark">{formatDate(p.paidAt)}</span>
                  <span className="font-bold">{formatEur(p.amount)}</span>
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

      <InPageTabs tabs={tabs} ariaLabel="Seccions de la fitxa" />
    </main>
  );
}
