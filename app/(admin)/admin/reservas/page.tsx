import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { listReservations } from "@/lib/data/reservations";
import {
  SERVICE_LABELS,
  RESERVATION_STATUS_LABELS,
  formatDate,
} from "@/lib/labels";
import type { ReservationStatus } from "@/types/database";

const STATUS_TONE: Record<ReservationStatus, "info" | "success" | "danger"> = {
  booked: "info",
  completed: "success",
  cancelled: "danger",
};

export default async function ReservasPage() {
  const reservations = await listReservations();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administración" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Volver
        </Link>
        <h1 className="mt-1 text-2xl text-brand-dark">Reservas</h1>

        <div className="mt-6 overflow-hidden rounded-2xl border border-brand-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Entrenador</th>
                <th className="px-4 py-3 font-bold">Servicio</th>
                <th className="px-4 py-3 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-brand-border last:border-0"
                >
                  <td className="px-4 py-3 font-bold text-brand-dark">
                    {formatDate(r.scheduledAt)}
                  </td>
                  <td className="px-4 py-3">{r.clientName}</td>
                  <td className="px-4 py-3">
                    {r.trainerName ?? (
                      <span className="text-brand-muted italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{SERVICE_LABELS[r.serviceType]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>
                      {RESERVATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
