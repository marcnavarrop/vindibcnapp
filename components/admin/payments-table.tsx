"use client";

import { useState, useTransition } from "react";
import { TAP } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { loadMorePaymentsAction } from "@/app/(admin)/admin/pagos/actions";
import type { PaymentRowView } from "@/lib/payment-row";

/**
 * La llista de pagaments, per pàgines.
 *
 * La primera pàgina arriba del servidor i «Carregar més» hi afegeix la
 * següent amb el cursor. Les files arriben ja escrites (`toPaymentRow`): aquí
 * no es formata cap data ni cap import, per no dependre de l'`Intl` del
 * navegador.
 */
export function PaymentsTable({
  initialRows,
  initialCursor,
  total,
}: {
  initialRows: PaymentRowView[];
  initialCursor: string | null;
  /** Quants pagaments hi ha en total (null si no s'ha pogut saber). */
  total: number | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const res = await loadMorePaymentsAction(cursor);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Per id: si mentrestant s'ha repintat la pàgina, cap fila surt dos cops.
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.rows.filter((r) => !seen.has(r.id))];
      });
      setCursor(res.nextCursor);
    });
  };

  if (rows.length === 0)
    return (
      <p className="mt-6 rounded-2xl border border-brand-border bg-white px-4 py-6 text-center text-sm text-brand-muted">
        Encara no hi ha cap pagament.
      </p>
    );

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="payments-table">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Data</th>
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Import</th>
              <th className="px-4 py-3 font-bold">Mètode</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-brand-border last:border-0">
                <td className="px-4 py-3 font-bold text-brand-dark">{p.date}</td>
                <td className="px-4 py-3">{p.clientName}</td>
                <td className="px-4 py-3 font-bold tabular-nums">{p.amount}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.method === "card" ? "info" : "warn"}>{p.methodLabel}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {total !== null && (
          <span className="text-brand-muted tabular-nums" data-testid="payments-shown">
            {rows.length} de {total} pagaments
          </span>
        )}
        {cursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className={`min-h-11 rounded-lg border border-brand-border bg-white px-4 font-bold text-brand-purple hover:bg-brand-bg active:bg-brand-bg disabled:opacity-60 ${TAP}`}
          >
            {pending ? "Carregant…" : "Carregar més"}
          </button>
        )}
        {error && (
          <p role="alert" className="w-full text-error">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
