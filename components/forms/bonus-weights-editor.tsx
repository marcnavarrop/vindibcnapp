"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateWeightAction } from "@/app/(admin)/admin/facturacio/bonus-actions";
import { SERVICE_LABELS, formatDate } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export type WeightRowData = {
  serviceType: ServiceType;
  weight: number | null;
  effectiveFrom: string | null;
};

function WeightRow({ row }: { row: WeightRowData }) {
  const [state, action] = useActionState(updateWeightAction, {});

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
            : "Sense pes definit"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          name="weight"
          type="number"
          min={0}
          step={0.1}
          required
          defaultValue={row.weight ?? ""}
          aria-label={`Pes de ${SERVICE_LABELS[row.serviceType]}`}
          className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
        />
        <span className="text-sm text-brand-muted">unitats / sessió</span>
        <SubmitButton>Desar</SubmitButton>
      </div>

      {state.error && <p className="w-full text-xs text-error">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-success">Pes actualitzat.</p>}
    </form>
  );
}

export function BonusWeightsEditor({ rows }: { rows: WeightRowData[] }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-5">
      {rows.map((row) => (
        <WeightRow key={row.serviceType} row={row} />
      ))}
    </div>
  );
}
