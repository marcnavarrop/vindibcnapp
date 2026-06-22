import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getAdminStats } from "@/lib/data/stats";
import { DashboardHeader } from "@/components/dashboard-header";
import { formatEur } from "@/lib/labels";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/clients", title: "Clients", desc: "Fitxes, entrenador/a assignat/da i bons.", ready: true },
  { href: "/admin/bonos", title: "Bons", desc: "Paquets de sessions i el seu estat.", ready: true },
  { href: "/admin/reservas", title: "Reserves", desc: "Agenda de sessions.", ready: true },
  { href: "/admin/pagos", title: "Pagaments", desc: "Cobraments amb targeta i efectiu.", ready: true },
  { href: "/admin/serveis", title: "Serveis", desc: "Catàleg de serveis i preus.", ready: true },
  { href: "/admin/exercicis", title: "Exercicis", desc: "Biblioteca d'exercicis amb vídeo.", ready: true },
];

export default async function AdminHome() {
  const [viewer, stats] = await Promise.all([getViewer(), getAdminStats()]);

  const kpis = [
    { label: "Clients", value: String(stats.clients) },
    { label: "Bons actius", value: String(stats.activeBonos) },
    { label: "Sessions restants", value: String(stats.remainingSessions) },
    { label: "Ingressos", value: formatEur(stats.revenue) },
    { label: "Reserves properes", value: String(stats.upcomingReservations) },
  ];

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl text-brand-dark">
          Hola, {viewer?.fullName?.split(" ")[0] ?? "admin"}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Resum del centre.
        </p>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-brand-border bg-white p-4"
            >
              <div className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                {k.label}
              </div>
              <div className="mt-1 text-2xl font-bold text-brand-purple">
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Secciones */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <Link key={s.title} href={s.href}>
              <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-purple">
                <h2 className="text-lg text-brand-dark">{s.title}</h2>
                <p className="mt-1 text-sm text-brand-muted">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
