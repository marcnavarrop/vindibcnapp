import { getViewer } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { listClients } from "@/lib/data/clients";
import { listReservations } from "@/lib/data/reservations";
import {
  SERVICE_LABELS,
  RESERVATION_STATUS_LABELS,
  formatDate,
} from "@/lib/labels";

/**
 * Área del entrenador. El middleware garantiza el rol 'trainer'.
 * Solo ve sus clientes asignados y sus reservas.
 */
export default async function TrainerHome() {
  const viewer = await getViewer();
  const trainerId = viewer?.id;
  const [clients, reservations] = await Promise.all([
    listClients(trainerId),
    listReservations(trainerId),
  ]);

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Entrenador/a" home="/trainer" />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl text-brand-dark">
            Hola, {viewer?.fullName?.split(" ")[0] ?? "entrenador/a"}
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            {clients.length} clients · {reservations.length} reserves
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
            Els meus clients
          </h2>
          <div className="divide-y divide-brand-border">
            {clients.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="font-bold text-brand-dark">{c.fullName}</span>
                <span className="text-brand-muted">
                  {c.remainingSessions} sessions restants
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
            Properes reserves
          </h2>
          <div className="divide-y divide-brand-border">
            {reservations.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
              >
                <span className="font-bold text-brand-dark">
                  {formatDate(r.scheduledAt)}
                </span>
                <span>{r.clientName}</span>
                <span className="text-brand-muted">
                  {SERVICE_LABELS[r.serviceType]}
                </span>
                <Badge tone={r.status === "completed" ? "success" : "info"}>
                  {RESERVATION_STATUS_LABELS[r.status]}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
