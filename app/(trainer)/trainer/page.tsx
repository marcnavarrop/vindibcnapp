import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { listClients } from "@/lib/data/clients";
import { listReservations } from "@/lib/data/reservations";
import { listAnnouncements } from "@/lib/data/announcements";
import { getTrainerDashboard } from "@/lib/data/dashboard";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { TrainerUpcomingReservations } from "@/components/trainer-upcoming-reservations";
import { TrainerBonusPanel } from "@/components/trainer-bonus-panel";
import { LowBonosCard } from "@/components/low-bonos-card";
import { Kpi, pct1 } from "@/components/ui/kpi";
import { formatLongDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/trainer/clients", title: "Clients", desc: "Fitxes i seguiment de tot el centre." },
  { href: "/trainer/reservas", title: "Reserves", desc: "Agenda i noves sessions." },
  { href: "/trainer/bonos", title: "Bons", desc: "Bons dels clients." },
  { href: "/trainer/exercicis", title: "Exercicis", desc: "Biblioteca del centre." },
];

/**
 * Área del entrenador/a. El middleware garantiza el rol 'trainer'.
 * Ve a todos los clientes para coordinarse; gestiona solo los suyos.
 */
export default async function TrainerHome() {
  const viewer = await getViewer();
  const trainerId = viewer?.id ?? "";
  const [clients, allReservations, announcements, kpi] = await Promise.all([
    listClients(trainerId),
    listReservations(), // totes les reserves del centre per al toggle Els meus / Tots
    listAnnouncements(),
    getTrainerDashboard(trainerId),
  ]);

  return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div>
          <p className="text-sm text-brand-muted">{formatLongDate(new Date())}</p>
          <h1 className="mt-0.5 text-2xl text-brand-dark">
            Hola, {viewer?.fullName?.split(" ")[0] ?? "professional"}
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            {clients.length} clients assignats
          </p>
        </div>

        {/* Resum del dia. Mateixes targetes que el tauler d'admin, però només
            amb el que és seu: res d'ingressos ni de pendents de cobrament. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Kpi
            label="Sessions"
            value={String(kpi.sessions.today)}
            hint={`avui · ${kpi.sessions.week} aquesta setmana`}
            href="/trainer/reservas"
          />

          {/* Sempre visible, també amb zero: que no hi hagi res pendent és
              informació, i una graella que canvia de mida cada dia es llegeix
              pitjor. El to d'avís només salta quan demana acció. */}
          <Kpi
            label="Proves pendents"
            value={String(kpi.pendingTrials)}
            tone={kpi.pendingTrials > 0 ? "warn" : "neutral"}
            hint={
              kpi.pendingTrials === 0
                ? "Cap sol·licitud per respondre"
                : kpi.pendingTrials === 1
                  ? "1 sol·licitud esperant resposta"
                  : `${kpi.pendingTrials} sol·licituds esperant resposta`
            }
            href="/trainer/reservas"
          />

          <Kpi
            label="Els teus clients"
            value={String(kpi.clients)}
            hint={
              kpi.clients === 1 ? "client assignat" : "clients assignats a tu"
            }
            href="/trainer/clients"
          />

          <Kpi
            label="Ocupació setmanal"
            value={
              kpi.occupancy.slots > 0 ? `${pct1(kpi.occupancy.pct)}%` : "—"
            }
            hint={
              kpi.occupancy.slots > 0
                ? `${kpi.occupancy.booked} de ${kpi.occupancy.slots} franges teves`
                : "Sense disponibilitat definida"
            }
            href="/trainer/disponibilitat"
          >
            {kpi.occupancy.slots > 0 && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-brand-bg">
                <div
                  className="h-full rounded-full bg-brand-purple"
                  style={{ width: `${Math.min(100, kpi.occupancy.pct)}%` }}
                />
              </div>
            )}
          </Kpi>

          {/* Ocupa la cel·la restant del grid; la llista pot créixer. */}
          <LowBonosCard
            bonos={kpi.lowBonos}
            clientHrefBase="/trainer/clients"
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {/* No renderitza res si aquest professional no té bonus actiu. */}
        <TrainerBonusPanel trainerId={trainerId} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href}>
              <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-purple">
                <h2 className="text-lg text-brand-dark">{s.title}</h2>
                <p className="mt-1 text-sm text-brand-muted">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <div className="flex items-center justify-between border-b border-brand-border bg-brand-bg px-5 py-3">
            <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
              Els meus clients
            </h2>
            <Link
              href="/trainer/clients"
              className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
            >
              Veure tots
            </Link>
          </div>
          <div className="divide-y divide-brand-border">
            {clients.length === 0 ? (
              <p className="px-5 py-3 text-sm text-brand-muted">
                Encara no tens clients assignats.
              </p>
            ) : (
              clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/trainer/clients/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-brand-bg/50"
                >
                  <span className="font-bold text-brand-dark">
                    {c.fullName}
                  </span>
                  <span className="text-brand-muted">
                    {c.remainingSessions} sessions restants
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <TrainerUpcomingReservations
          reservations={allReservations}
          myId={trainerId}
        />

        <section>
          <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
            Comunitat
          </h2>
          <AnnouncementsFeed announcements={announcements} />
        </section>
      </main>
  );
}
