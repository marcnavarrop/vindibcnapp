import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { ReservationsAgenda } from "@/components/reservations-agenda";
import { listReservations } from "@/lib/data/reservations";
import { listTrainers } from "@/lib/data/clients";

export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const [reservations, trainers] = await Promise.all([
    listReservations(),
    listTrainers(),
  ]);
  const nowISO = new Date().toISOString();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Agenda de reserves</h1>

        <ReservationsAgenda
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
        />
      </main>
    </div>
  );
}
