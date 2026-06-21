import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { listPayments } from "@/lib/data/payments";
import { PAYMENT_METHOD_LABELS, formatEur, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PagosPage() {
  const payments = await listPayments();
  const total = payments.reduce((s, p) => s + p.amount, 0);

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
            <h1 className="mt-1 text-2xl text-brand-dark">Pagos</h1>
          </div>
          <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-bold text-success">
            {formatEur(total)} cobrado
          </span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-border bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Importe</th>
                <th className="px-4 py-3 font-bold">Método</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-brand-border last:border-0"
                >
                  <td className="px-4 py-3 font-bold text-brand-dark">
                    {formatDate(p.paidAt)}
                  </td>
                  <td className="px-4 py-3">{p.clientName}</td>
                  <td className="px-4 py-3 font-bold">{formatEur(p.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.method === "card" ? "info" : "warn"}>
                      {PAYMENT_METHOD_LABELS[p.method]}
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
