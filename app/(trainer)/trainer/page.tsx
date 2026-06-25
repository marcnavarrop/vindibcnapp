import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { listClients } from "@/lib/data/clients";
import { listReservations } from "@/lib/data/reservations";
import { listAnnouncements } from "@/lib/data/announcements";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import {
  SERVICE_LABELS,
  RESERVATION_STATUS_LABELS,
  formatDate,
  formatLongDate,
} from "@/lib/labels";

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
  const trainerId = viewer?.id;
  const [clients, reservations, announcements] = await Promise.all([
    listClients(trainerId),
    listReservations(trainerId),
    listAnnouncements(),
  ]);

  const nowISO = new Date().toISOString();
  const upcoming = reservations
    .filter((r) => r.scheduledAt >= nowISO)
    .slice(0, 6);

  return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div>
          <p className="text-sm text-brand-muted">{formatLongDate(new Date())}</p>
          <h1 className="mt-0.5 text-2xl text-brand-dark">
            Hola, {viewer?.fullName?.split(" ")[0] ?? "entrenador/a"}
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            {clients.length} clients assignats · {reservations.length} reserves
          </p>
        </div>

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

        <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
            Properes reserves
          </h2>
          <div className="divide-y divide-brand-border">
            {upcoming.length === 0 ? (
              <p className="px-5 py-3 text-sm text-brand-muted">
                No tens reserves properes.
              </p>
            ) : (
              upcoming.map((r) => (
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
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
            Comunitat
          </h2>
          <AnnouncementsFeed announcements={announcements} />
        </section>
      </main>
  );
}
