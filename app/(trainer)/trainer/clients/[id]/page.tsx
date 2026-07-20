import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { getClient } from "@/lib/data/clients";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listExercises } from "@/lib/data/exercises";
import { listClientDocuments } from "@/lib/data/client-documents";
import { DocumentsReadonlyPanel } from "@/components/documents-readonly-panel";
import { getConsentStatus } from "@/lib/data/consents";
import { HealthConsentWarning } from "@/components/health-consent-warning";
import {
  assignExerciseTrainerAction,
  removeExerciseTrainerAction,
} from "@/app/(trainer)/trainer/clients/exercises-actions";
import { AssignedExercisesPanel } from "@/components/assigned-exercises-panel";
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
  const [viewer, client, assignedExercises, library, documents] = await Promise.all([
    getViewer(),
    getClient(id),
    listClientExercises(id),
    listExercises(),
    listClientDocuments(id),
  ]);
  if (!client) notFound();

  const canManage = !!viewer && client.assignedTrainerId === viewer.id;

  const consent = await getConsentStatus(client.profileId);
  const receivesFisio =
    client.bonos.some((b) => b.serviceType === "fisioterapia") ||
    client.reservations.some((r) => r.serviceType === "fisioterapia");
  const needsHealthConsent = receivesFisio && !consent.healthDataAt;

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
            <p className="text-sm text-brand-muted">
              {client.email}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
          </div>
          {!canManage && (
            <span className="rounded-full bg-brand-muted/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
              Només lectura
            </span>
          )}
        </div>

        {needsHealthConsent && <HealthConsentWarning />}

        <section className="grid gap-4 sm:grid-cols-3">
          <Info
            label="Entrenador/a"
            value={client.trainerName ?? "Sense assignar"}
          />
          <Info label="Bons actius" value={String(client.activeBonos)} />
          <Info
            label="Sessions restants"
            value={String(client.remainingSessions)}
          />
        </section>

        {client.notes && (
          <section className="rounded-2xl border border-brand-border bg-white p-5">
            <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
              Notes
            </h2>
            <p className="mt-1 text-sm text-brand-charcoal">{client.notes}</p>
          </section>
        )}

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
                <Badge tone={b.status === "active" ? "success" : "neutral"}>
                  {BONO_STATUS_LABELS[b.status]}
                </Badge>
              </Row>
            ))
          )}
        </Panel>

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

        {client.payments.length > 0 && (
          <Panel title="Pagaments">
            {client.payments.map((p) => (
              <Row key={p.id}>
                <span className="font-bold text-brand-dark">
                  {formatDate(p.paidAt)}
                </span>
                <span className="font-bold">{formatEur(p.amount)}</span>
                <Badge tone={p.method === "card" ? "info" : "warn"}>
                  {PAYMENT_METHOD_LABELS[p.method]}
                </Badge>
              </Row>
            ))}
          </Panel>
        )}

        {/* Documents */}
        <DocumentsReadonlyPanel documents={documents} clientId={id} />

        <AssignedExercisesPanel
          assigned={assignedExercises}
          library={library}
          canManage={canManage}
          assignAction={assignExerciseTrainerAction.bind(null, client.id)}
          removeAction={removeExerciseTrainerAction.bind(null, client.id)}
        />
      </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-5">
      <div className="text-xs font-bold tracking-wide text-brand-muted uppercase">
        {label}
      </div>
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
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          {title}
        </h2>
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
