import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listMeasurements } from "@/lib/data/measurements";
import { listAnnouncements } from "@/lib/data/announcements";
import Link from "next/link";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { Badge } from "@/components/ui/badge";
import { cancelOwnReservationAction } from "@/app/(client)/client/reservas/actions";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatEur,
  formatDate,
} from "@/lib/labels";

/**
 * Área del cliente. El middleware garantiza el rol 'client'.
 * Solo ve sus propios bonos, reservas y pagos.
 */
export default async function ClientHome() {
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const measurements = client ? await listMeasurements(client.id) : [];
  const announcements = await listAnnouncements();

  return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl text-brand-dark">
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
            <Panel title="Els meus bons">
              {client.bonos.map((b) => (
                <Row key={b.id}>
                  <span className="font-bold text-brand-dark">
                    {SERVICE_LABELS[b.serviceType]}
                  </span>
                  <span className="text-brand-muted">
                    {b.remainingSessions} / {b.totalSessions} sessions
                  </span>
                  <Badge tone={b.status === "active" ? "success" : "neutral"}>
                    {BONO_STATUS_LABELS[b.status]}
                  </Badge>
                </Row>
              ))}
            </Panel>

            <Panel
              title="Les meves reserves"
              action={
                <Link
                  href="/client/reservas"
                  className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                >
                  + Reservar
                </Link>
              }
            >
              {client.reservations.length === 0 ? (
                <p className="px-5 py-3 text-sm text-brand-muted">
                  Encara no tens reserves.
                </p>
              ) : (
                client.reservations.map((r) => {
                  const cancellable =
                    r.status === "booked" &&
                    new Date(r.scheduledAt).getTime() > Date.now();
                  return (
                    <Row key={r.id}>
                      <span className="font-bold text-brand-dark">
                        {formatDate(r.scheduledAt)}
                      </span>
                      <span className="text-brand-muted">
                        {SERVICE_LABELS[r.serviceType]}
                      </span>
                      <Badge
                        tone={r.status === "completed" ? "success" : "info"}
                      >
                        {RESERVATION_STATUS_LABELS[r.status]}
                      </Badge>
                      {cancellable && (
                        <form
                          action={cancelOwnReservationAction}
                          className="ml-auto"
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-error hover:bg-error/10"
                          >
                            Cancel·lar
                          </button>
                        </form>
                      )}
                    </Row>
                  );
                })
              )}
            </Panel>

            <Panel title="Els meus pagaments">
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

            <Panel title="El meu progrés">
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
