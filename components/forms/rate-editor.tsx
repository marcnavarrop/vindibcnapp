"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateRateAction } from "@/app/(admin)/admin/facturacio/actions";
import { SERVICE_LABELS, formatDate } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export type RateRowData = {
  serviceType: ServiceType;
  amount: number | null;
  effectiveFrom: string | null;
};

/**
 * Una tarifa editable. Cada fila és un formulari independent: desar la tarifa
 * d'un servei no toca les altres, i l'estat d'error queda al costat del camp
 * que l'ha provocat.
 */
function RateRow({ row }: { row: RateRowData }) {
  const [state, action] = useActionState(updateRateAction, {});

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-3 border-b border-brand-border py-3 last:border-0"
    >
      <input type="hidden" name="serviceType" value={row.serviceType} />

      <div className="min-w-40 flex-1">
        <p className="text-sm font-bold text-brand-dark">
          {SERVICE_LABELS[row.serviceType]}
        </p>
        <p className="text-xs text-brand-muted">
          {row.effectiveFrom
            ? `Vigent des del ${formatDate(row.effectiveFrom)}`
            : "Sense tarifa definida"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          name="rateAmount"
          type="number"
          min={0}
          step={0.5}
          required
          defaultValue={row.amount ?? ""}
          aria-label={`Tarifa de ${SERVICE_LABELS[row.serviceType]}`}
          className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
        />
        <span className="text-sm text-brand-muted">€ / sessió</span>
        <SubmitButton>Desar</SubmitButton>
      </div>

      {state.error && <p className="w-full text-xs text-error">{state.error}</p>}
      {state.ok && (
        <p className="w-full text-xs text-success">Tarifa actualitzada.</p>
      )}
    </form>
  );
}

/** Les quatre tarifes del centre. No hi ha selector de professional: la
 *  tarifa d'un servei és la mateixa per a tothom. */
export function RateEditor({ rows }: { rows: RateRowData[] }) {
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5">
      {rows.map((row) => (
        <RateRow key={row.serviceType} row={row} />
      ))}
    </section>
  );
}
