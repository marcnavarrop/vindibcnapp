import Link from "next/link";
import { TAP } from "@/lib/utils";
import { getPaymentsSummary, listPayments, type PaymentsSummary } from "@/lib/data/payments";
import { toPaymentRow } from "@/lib/payment-row";
import { formatEur } from "@/lib/labels";
import { GroupTabs } from "@/components/ui/group-tabs";
import { PaymentsTable } from "@/components/admin/payments-table";
import { BONS_TABS } from "@/lib/admin-tabs";

export const dynamic = "force-dynamic";

export default async function PagosPage() {
  // El total el compta la base (`payments_summary`, 0095): no depèn de quantes
  // files s'hagin carregat. Si falla, es diu; un «0 € cobrat» semblaria cert.
  const [summary, page] = await Promise.all([
    getPaymentsSummary().catch((e): PaymentsSummary | null => {
      console.error("[pagaments] total:", e);
      return null;
    }),
    listPayments(),
  ]);

  return (
    <>
      <main className="mx-auto max-w-5xl p-6">
        <GroupTabs tabs={BONS_TABS} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl text-brand-dark">Pagaments</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-full bg-success/10 px-3 py-1 text-sm font-bold text-success tabular-nums"
              data-testid="payments-total"
            >
              {summary ? `${formatEur(summary.total)} cobrat` : "Total no disponible"}
            </span>
            <Link
              href="/admin/pagos/new"
              className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
            >
              + Nou pagament
            </Link>
          </div>
        </div>

        {summary ? (
          <p className="mt-2 text-sm text-brand-muted tabular-nums" data-testid="payments-breakdown">
            {summary.count} pagaments · Targeta (TPV) {formatEur(summary.cardTpv.total)} ({summary.cardTpv.count}) ·
            Targeta (en línia) {formatEur(summary.cardOnline.total)} ({summary.cardOnline.count}) ·
            Efectiu {formatEur(summary.cash.total)} ({summary.cash.count})
          </p>
        ) : (
          <p role="alert" className="mt-2 text-sm text-error">
            No s&apos;ha pogut calcular el total. La llista és correcta; torna a carregar la pàgina
            d&apos;aquí a una estona.
          </p>
        )}

        <PaymentsTable
          initialRows={page.items.map(toPaymentRow)}
          initialCursor={page.nextCursor}
          total={summary?.count ?? null}
        />
      </main>
    </>
  );
}
