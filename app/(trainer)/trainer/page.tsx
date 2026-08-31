import { getViewer } from "@/lib/auth";
import { listClients } from "@/lib/data/clients";
import { listReservations } from "@/lib/data/reservations";
import { listAnnouncements } from "@/lib/data/announcements";
import { getTrainerDashboard } from "@/lib/data/dashboard";
import { pendingTrialAttention } from "@/lib/data/trial-attention";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { TrainerUpcomingReservations } from "@/components/trainer-upcoming-reservations";
import { TrainerBonusPanel } from "@/components/trainer-bonus-panel";
import { LowBonosCard } from "@/components/low-bonos-card";
import {
  Header,
  KpiRow,
  Attention,
  QuickActions,
  MyClients,
} from "@/components/trainer/home-sections";
import { formatLongDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Àrea del professional. El middleware garanteix el rol 'trainer'.
 * Veu tots els clients per coordinar-se; gestiona només els seus.
 */
export default async function TrainerHome() {
  const viewer = await getViewer();
  const trainerId = viewer?.id ?? "";

  const [clients, allReservations, announcements, kpi, trials] =
    await Promise.all([
      listClients(trainerId),
      listReservations(), // totes les del centre, per al toggle Els meus / Tots
      listAnnouncements(),
      getTrainerDashboard(trainerId),
      // Lectura pura: obrir l'inici no ha d'escriure res.
      pendingTrialAttention(trainerId),
    ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Header
        name={viewer?.fullName?.split(" ")[0] ?? "professional"}
        today={formatLongDate(new Date())}
        clientCount={clients.length}
      />

      <KpiRow d={kpi} />

      <QuickActions />

      {/* Per damunt de l'agenda: si hi ha una prova que caduca, es veu abans
          de posar-se a mirar les sessions. Sense res pendent, no es pinta. */}
      <Attention trials={trials} />

      <TrainerUpcomingReservations
        reservations={allReservations}
        myId={trainerId}
      />

      {/* No renderitza res si aquest professional no té bonus actiu. */}
      <TrainerBonusPanel trainerId={trainerId} />

      {/* El detall que abans vivia dins de la targeta de bons baixos. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LowBonosCard bonos={kpi.lowBonos} clientHrefBase="/trainer/clients" />
        <MyClients clients={clients} />
      </div>

      <section>
        <h2 className="mb-3 text-xs font-bold tracking-widest text-brand-muted uppercase">
          Comunitat
        </h2>
        <AnnouncementsFeed announcements={announcements} />
      </section>
    </main>
  );
}
