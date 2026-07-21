import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listAnnouncements } from "@/lib/data/announcements";
import { getCenterSettings } from "@/lib/data/center-settings";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { Badge } from "@/components/ui/badge";
import { CancelReservationButton } from "@/components/forms/cancel-reservation-button";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  formatDate,
  formatLongDate,
} from "@/lib/labels";

/**
 * Inici del área del cliente: resumen rápido (bonos activos, próximas reservas
 * y comunidad). El detalle completo de bonos y pagos vive en /client/bonos.
 */
export default async function ClientHome() {
  const viewer = await getViewer();
  const [client, announcements, centerSettings] = await Promise.all([
    viewer ? getClientByProfile(viewer.id) : Promise.resolve(null),
    listAnnouncements(),
    getCenterSettings(),
  ]);

  const nowISO = new Date().toISOString();
  const minMs = centerSettings.minCancellationHours * 60 * 60 * 1000;
  const activeBonos = client?.bonos.filter((b) => b.status === "active") ?? [];
  const upcoming =
    client?.reservations
      .filter((r) => r.status === "booked" && r.scheduledAt >= nowISO)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 3) ?? [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <p className="text-sm text-brand-muted">{formatLongDate(new Date())}</p>
        <h1 className="mt-0.5 text-2xl text-brand-dark">
          Hola, {viewer?.fullName?.split(" ")[0] ?? ""}
        </h1>
        {client && (
          <p className="mt-1 text-sm text-brand-muted">
            {client.remainingSessions} sessions restants en{" "}
            {client.activeBonos} bons actius
          </p>
        )}
      </div>

      {!client ? (
        <div className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no tens fitxa de client.
        </div>
      ) : (
        <>
          <Panel
            title="Bons actius"
            action={
              <Link
                href="/client/bonos"
                className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
              >
                Veure tots
              </Link>
            }
          >
            {activeBonos.length === 0 ? (
              <p className="px-5 py-3 text-sm text-brand-muted">
                No tens cap bo actiu.
              </p>
            ) : (
              activeBonos.map((b) => (
                <Row key={b.id}>
                  <span className="font-bold text-brand-dark">
                    {SERVICE_LABELS[b.serviceType]}
                  </span>
                  <span className="text-brand-muted">
                    {b.remainingSessions} / {b.totalSessions} sessions
                  </span>
                  <Badge tone="success">{BONO_STATUS_LABELS[b.status]}</Badge>
                </Row>
              ))
            )}
          </Panel>

          <Panel
            title="Properes reserves"
            action={
              <Link
                href="/client/reservas"
                className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
              >
                + Reservar
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <p className="px-5 py-3 text-sm text-brand-muted">
                No tens reserves properes.
              </p>
            ) : (
              upcoming.map((r) => (
                <Row key={r.id}>
                  <span className="font-bold text-brand-dark">
                    {formatDate(r.scheduledAt)}
                  </span>
                  <span className="text-brand-muted">
                    {SERVICE_LABELS[r.serviceType]}
                  </span>
                  <Badge tone="info">
                    {RESERVATION_STATUS_LABELS[r.status]}
                  </Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <AddToCalendarButton
                      serviceType={r.serviceType}
                      trainerName={r.trainerName}
                      scheduledAt={r.scheduledAt}
                    />
                    <CancelReservationButton
                      id={r.id}
                      scheduledAt={r.scheduledAt}
                      minCancellationHours={centerSettings.minCancellationHours}
                      minMs={minMs}
                    />
                  </div>
                </Row>
              ))
            )}
          </Panel>
        </>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
          Comunitat
        </h2>
        <AnnouncementsFeed announcements={announcements} />
      </section>
    </main>
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
    <section className="rounded-2xl border border-brand-border bg-white">
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
