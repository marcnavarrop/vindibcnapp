import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listServices } from "@/lib/data/services";
import { toggleServiceAction } from "@/app/(admin)/admin/serveis/actions";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ServeisPage() {
  const services = await listServices();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl text-brand-dark">Serveis i preus</h1>
          <Link
            href="/admin/serveis/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nou servei
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Nom</th>
                <th className="px-4 py-3 font-bold">Tipus</th>
                <th className="px-4 py-3 font-bold">Preu</th>
                <th className="px-4 py-3 font-bold">Sessions</th>
                <th className="px-4 py-3 font-bold">Estat</th>
                <th className="px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-brand-border last:border-0"
                >
                  <td className="px-4 py-3 font-bold text-brand-dark">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-brand-muted">
                    {SERVICE_LABELS[s.serviceType]}
                  </td>
                  <td className="px-4 py-3">{formatEur(s.price)}</td>
                  <td className="px-4 py-3">{s.defaultSessions}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.active ? "success" : "neutral"}>
                      {s.active ? "Actiu" : "Inactiu"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/serveis/${s.id}/edit`}
                        className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                      >
                        Editar
                      </Link>
                      <form action={toggleServiceAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={String(!s.active)}
                        />
                        <button
                          type="submit"
                          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark"
                        >
                          {s.active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
  );
}
