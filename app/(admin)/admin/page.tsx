import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";

const SECTIONS = [
  { href: "/admin/clients", title: "Clientes", desc: "Fichas, entrenador asignado y bonos.", ready: true },
  { href: "/admin", title: "Bonos", desc: "Paquetes de sesiones y su estado.", ready: false },
  { href: "/admin", title: "Reservas", desc: "Agenda de sesiones.", ready: false },
  { href: "/admin", title: "Pagos", desc: "Cobros en tarjeta y efectivo.", ready: false },
];

/**
 * Panel de administración. El acceso lo garantiza el middleware (rol 'admin').
 */
export default async function AdminHome() {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administración" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl text-brand-dark">
          Hola, {viewer?.fullName?.split(" ")[0] ?? "admin"}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Gestión del centro. Empieza por los clientes.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s, i) => {
            const card = (
              <div
                className={`flex h-full flex-col rounded-2xl border border-brand-border bg-white p-5 transition-colors ${
                  s.ready ? "hover:border-brand-purple" : "opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg text-brand-dark">{s.title}</h2>
                  {!s.ready && (
                    <span className="text-[10px] font-bold tracking-wide text-brand-muted uppercase">
                      Próximamente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-brand-muted">{s.desc}</p>
              </div>
            );
            return s.ready ? (
              <Link key={i} href={s.href}>
                {card}
              </Link>
            ) : (
              <div key={i}>{card}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
