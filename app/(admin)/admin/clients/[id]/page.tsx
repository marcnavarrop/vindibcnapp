import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { getClient } from "@/lib/data/clients";
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
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administración" home="/admin" />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div>
          <Link
            href="/admin/clients"
            className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
          >
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl text-brand-dark">{client.fullName}</h1>
          <p className="text-sm text-brand-muted">
            {client.email}
            {client.phone ? ` · ${client.phone}` : ""}
          </p>
        </div>

        {/* Ficha */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Info label="Entrenador" value={client.trainerName ?? "Sin asignar"} />
          <Info label="Bonos activos" value={String(client.activeBonos)} />
          <Info
            label="Sesiones restantes"
            value={String(client.remainingSessions)}
          />
        </section>

        {client.notes && (
          <section className="rounded-2xl border border-brand-border bg-white p-5">
            <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
              Notas
            </h2>
            <p className="mt-1 text-sm text-brand-charcoal">{client.notes}</p>
          </section>
        )}

        {/* Bonos */}
        <Panel title="Bonos">
          {client.bonos.map((b) => (
            <Row key={b.id}>
              <span className="font-bold text-brand-dark">
                {SERVICE_LABELS[b.serviceType]}
              </span>
              <span className="text-brand-muted">
                {b.remainingSessions} / {b.totalSessions} sesiones
              </span>
              <span>{formatEur(b.price)}</span>
              <Badge tone={b.status === "active" ? "success" : "neutral"}>
                {BONO_STATUS_LABELS[b.status]}
              </Badge>
            </Row>
          ))}
        </Panel>

        {/* Reservas */}
        <Panel title="Reservas">
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
        <Panel title="Pagos">
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
      </main>
    </div>
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
        {title}
      </h2>
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
