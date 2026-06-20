import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { listClients } from "@/lib/data/clients";

/**
 * Listado de clientes (modo simulación o Supabase, según USE_MOCK).
 */
export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administración" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
            >
              ← Volver
            </Link>
            <h1 className="mt-1 text-2xl text-brand-dark">Clientes</h1>
          </div>
          <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-sm font-bold text-brand-purple">
            {clients.length} clientes
          </span>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-brand-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Contacto</th>
                <th className="px-4 py-3 font-bold">Entrenador</th>
                <th className="px-4 py-3 font-bold">Bonos activos</th>
                <th className="px-4 py-3 font-bold">Sesiones rest.</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-brand-border last:border-0 hover:bg-brand-bg/50"
                >
                  <td className="px-4 py-3 font-bold text-brand-dark">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="hover:text-brand-purple hover:underline"
                    >
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">
                    <div>{c.email}</div>
                    {c.phone && <div className="text-xs">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {c.trainerName ?? (
                      <span className="text-brand-muted italic">
                        Sin asignar
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.activeBonos}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-brand-purple">
                      {c.remainingSessions}
                    </span>
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
