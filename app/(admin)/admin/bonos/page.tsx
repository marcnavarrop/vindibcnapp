import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { listBonos } from "@/lib/data/bonos";
import { SERVICE_LABELS, BONO_STATUS_LABELS, formatEur } from "@/lib/labels";
import type { BonoStatus } from "@/types/database";

const STATUS_TONE: Record<BonoStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
};

export const dynamic = "force-dynamic";

export default async function BonosPage() {
  const bonos = await listBonos();

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
        <h1 className="mt-1 text-2xl text-brand-dark">Bonos</h1>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-border bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Servicio</th>
                <th className="px-4 py-3 font-bold">Sesiones</th>
                <th className="px-4 py-3 font-bold">Precio</th>
                <th className="px-4 py-3 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {bonos.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-brand-border last:border-0"
                >
                  <td className="px-4 py-3 font-bold text-brand-dark">
                    {b.clientName}
                  </td>
                  <td className="px-4 py-3">{SERVICE_LABELS[b.serviceType]}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-brand-purple">
                      {b.remainingSessions}
                    </span>
                    <span className="text-brand-muted">
                      {" "}
                      / {b.totalSessions}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatEur(b.price)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[b.status]}>
                      {BONO_STATUS_LABELS[b.status]}
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
