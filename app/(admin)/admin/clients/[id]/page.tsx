import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getClient } from "@/lib/data/clients";
import { listMeasurements } from "@/lib/data/measurements";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listExercises } from "@/lib/data/exercises";
import { getConsentStatus } from "@/lib/data/consents";
import { HealthConsentWarning } from "@/components/health-consent-warning";
import { deleteMeasurementAction } from "@/app/(admin)/admin/clients/progres-actions";
import {
  assignExerciseAction,
  removeExerciseAction,
} from "@/app/(admin)/admin/clients/exercises-actions";
import { AssignedExercisesPanel } from "@/components/assigned-exercises-panel";
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
  const [client, measurements, assignedExercises, library] = await Promise.all([
    getClient(id),
    listMeasurements(id),
    listClientExercises(id),
    listExercises(),
  ]);
  if (!client) notFound();

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
          </div>
        </div>

        {needsHealthConsent && <HealthConsentWarning />}

        {/* Ficha */}
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

        {/* Bonos */}
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
          {client.bonos.map((b) => (
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
          ))}
        </Panel>

        {/* Reservas */}
        <Panel title="Reserves">
          {client.reservations.map((r) => (
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
          ))}
        </Panel>

        {/* Pagos */}
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

        {/* Exercicis assignats */}
        <AssignedExercisesPanel
          assigned={assignedExercises}
          library={library}
          canManage
          assignAction={assignExerciseAction.bind(null, client.id)}
          removeAction={removeExerciseAction.bind(null, client.id)}
        />

        {/* Progrés */}
        <Panel
          title="Progrés"
          action={
            <Link
              href={`/admin/clients/${client.id}/progres/new`}
              className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
            >
              + Afegir mesura
            </Link>
          }
        >
          {measurements.length === 0 ? (
            <p className="px-5 py-3 text-sm text-brand-muted">
              Encara no hi ha mesures.
            </p>
          ) : (
            measurements.map((m) => (
              <Row key={m.id}>
                <span className="font-bold text-brand-dark">
                  {formatDate(m.recordedAt)}
                </span>
                {m.weightKg != null && (
                  <span className="font-bold text-brand-purple">
                    {m.weightKg} kg
                  </span>
                )}
                {m.notes && (
                  <span className="text-brand-muted">{m.notes}</span>
                )}
                <form action={deleteMeasurementAction} className="ml-auto">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <button
                    type="submit"
                    className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                  >
                    Eliminar
                  </button>
                </form>
              </Row>
            ))
          )}
        </Panel>
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
