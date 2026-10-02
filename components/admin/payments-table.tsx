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
      {/* Al mòbil, una fila de dues línies per pagament (no hi ha cap acció per
          fila: no calen targetes separades). A partir de 768 px, la taula. */}
      <ul
        className="mt-6 divide-y divide-brand-border overflow-hidden rounded-2xl border border-brand-border bg-white md:hidden"
        data-testid="payments-list"
      >
        {rows.map((p) => (
          <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3.5 py-2" data-testid="payment-card">
            <span className="min-w-0 truncate font-bold text-brand-dark">{p.clientName}</span>
            <span className="font-bold tabular-nums text-brand-dark">{p.amount}</span>
            {/* Una sola línia: el concepte sencer ocupava dues o tres línies i la
                fila arribava a 86 px. Sencer, a l'escriptori i al `title`. */}
            <span className="col-span-2 truncate text-[13px] text-brand-muted" title={p.concept ?? undefined}>
              {p.date} · {p.methodLabel}
              {p.concept && <> · {p.concept}</>}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-brand-border bg-white md:block">
        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="payments-table">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Data</th>
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Import</th>
              <th className="px-4 py-3 font-bold">Mètode</th>
              <th className="px-4 py-3 font-bold">Concepte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-brand-border last:border-0">
                <td className="px-4 py-3 font-bold text-brand-dark">{p.date}</td>
                <td className="px-4 py-3">{p.clientName}</td>
                <td className="px-4 py-3 font-bold tabular-nums">{p.amount}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge tone="neutral" icon={p.method === "card" ? "card" : "cash"}>{p.methodLabel}</Badge>
                </td>
                <td className="px-4 py-3 text-brand-muted">{p.concept ?? "—"}</td>
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
            className={`min-h-11 w-full rounded-lg border border-brand-border bg-white px-4 font-bold text-brand-purple hover:bg-brand-bg active:bg-brand-bg disabled:opacity-60 sm:w-auto ${TAP}`}
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
