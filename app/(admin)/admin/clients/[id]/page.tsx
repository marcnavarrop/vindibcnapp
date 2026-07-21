import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { getClient } from "@/lib/data/clients";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listExercises } from "@/lib/data/exercises";
import { getConsentStatus } from "@/lib/data/consents";
import { listClientDocuments } from "@/lib/data/client-documents";
import { listAllProgressForClient } from "@/lib/data/exercise-progress";
import { DocumentsReadonlyPanel } from "@/components/documents-readonly-panel";
import { HealthConsentWarning } from "@/components/health-consent-warning";
import { DeleteClientModal } from "@/components/delete-client-modal";
import { AssignedExercisesPanel } from "@/components/assigned-exercises-panel";
import { ClientProgressPanel } from "@/components/client-progress-panel";
import { ClientNotificationsPanel } from "@/components/client-notifications-panel";
import {
  assignExerciseAction,
  removeExerciseAction,
} from "@/app/(admin)/admin/clients/exercises-actions";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
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
  const [client, assignedExercises, library, documents, allProgress] = await Promise.all([
    getClient(id),
    listClientExercises(id),
    listExercises(),
    listClientDocuments(id),
    listAllProgressForClient(id),
  ]);
  if (!client) notFound();

  const consent = await getConsentStatus(client.profileId);
  const receivesFisio =
    client.bonos.some((b) => b.serviceType === "fisioterapia") ||
    client.reservations.some((r) => r.serviceType === "fisioterapia");
  const needsHealthConsent = receivesFisio && !consent.healthDataAt;

  const redirectPath = `/admin/clients/${id}`;

  const tabs = [
    {
      label: "Resum",
      content: (
        <div className="flex flex-col gap-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <Info label="Entrenador/a" value={client.trainerName ?? "Sense assignar"} />
            <Info label="Bons actius" value={String(client.activeBonos)} />
            <Info label="Sessions restants" value={String(client.remainingSessions)} />
          </section>
          {client.notes && (
            <section className="rounded-2xl border border-brand-border bg-white p-5">
              <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
                Notes
              </h2>
              <p className="mt-1 text-sm text-brand-charcoal">{client.notes}</p>
            </section>
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
            <Link
              href={`/admin/clients/${client.id}/bonos/new`}
              className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
            >
              + Afegir bo
            </Link>
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
                <Badge tone={b.status === "active" ? "success" : "neutral"}>
                  {BONO_STATUS_LABELS[b.status]}
                </Badge>
              </Row>
            ))
          )}
        </Panel>
      ),
    },
    {
      label: "Pagaments",
      content: (
        <Panel title="Pagaments">
          {client.payments.length === 0 ? (
            <Empty>Sense pagaments.</Empty>
          ) : (
            client.payments.map((p) => (
              <Row key={p.id}>
                <span className="font-bold text-brand-dark">{formatDate(p.paidAt)}</span>
                <span className="font-bold">{formatEur(p.amount)}</span>
                <Badge tone={p.method === "card" ? "info" : "warn"}>
                  {PAYMENT_METHOD_LABELS[p.method]}
                </Badge>
              </Row>
            ))
          )}
        </Panel>
      ),
    },
    {
      label: "Reserves",
      content: (
        <Panel title="Reserves">
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
          canManage
          assignAction={assignExerciseAction.bind(null, client.id)}
          removeAction={removeExerciseAction.bind(null, client.id)}
        />
      ),
    },
    {
      label: "Progrés",
      content: (
        <ClientProgressPanel
          assigned={assignedExercises}
          allProgress={allProgress}
          canManage
          redirectPath={redirectPath}
        />
      ),
    },
    {
      label: "Documents",
      content: <DocumentsReadonlyPanel documents={documents} clientId={id} />,
    },
    {
      label: "Notes",
      content: (
        <section className="rounded-2xl border border-brand-border bg-white p-5">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-brand-muted uppercase">
            Notes internes
          </h2>
          {client.notes ? (
            <p className="text-sm text-brand-charcoal">{client.notes}</p>
          ) : (
            <p className="text-sm text-brand-muted">Sense notes.</p>
          )}
          <div className="mt-4">
            <Link
              href={`/admin/clients/${client.id}/edit`}
              className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
            >
              Editar notes →
            </Link>
          </div>
        </section>
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
            href="/admin/clients"
            className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
          >
            ← Clients
          </Link>
          <h1 className="mt-1 text-2xl text-brand-dark">{client.fullName}</h1>
          <p className="text-sm text-brand-muted">
            {client.email}
            {client.phone ? ` · ${client.phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/clients/${client.id}/export`}
            className="inline-flex items-center justify-center rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-bold tracking-wide text-brand-charcoal uppercase transition-colors hover:bg-white/60"
          >
            Exportar dades
          </a>
          <Link
            href={`/admin/clients/${client.id}/edit`}
            className="inline-flex items-center justify-center rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-bold tracking-wide text-brand-charcoal uppercase transition-colors hover:bg-white/60"
          >
            Editar
          </Link>
          <DeleteClientModal clientId={client.id} clientName={client.fullName} />
        </div>
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
