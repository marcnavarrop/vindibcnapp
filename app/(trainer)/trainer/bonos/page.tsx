import { Badge } from "@/components/ui/badge";
import { listBonos } from "@/lib/data/bonos";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  formatEur,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function TrainerBonosPage() {
  const bonos = await listBonos();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Bons</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Vista de tots els bons del centre. Per crear-ne un, obre la fitxa del
          teu client.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Client</th>
                <th className="px-4 py-3 font-bold">Servei</th>
                <th className="px-4 py-3 font-bold">Sessions</th>
                <th className="px-4 py-3 font-bold">Preu</th>
                <th className="px-4 py-3 font-bold">Estat</th>
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
                    {b.remainingSessions} / {b.totalSessions}
                  </td>
                  <td className="px-4 py-3">{formatEur(b.price)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={b.status === "active" ? "success" : "neutral"}>
                      {BONO_STATUS_LABELS[b.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {bonos.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-brand-muted"
                  >
                    Encara no hi ha bons.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
  );
}
