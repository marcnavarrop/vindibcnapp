"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  updateWorkerBonusAction,
  generatePayoutAction,
} from "@/app/(admin)/admin/facturacio/bonus-actions";
import { formatEur } from "@/lib/labels";
import type { BonusPayoutFrequency } from "@/types/database";
import { TAP } from "@/lib/utils";

export type WorkerRowData = {
  trainerId: string;
  name: string;
  enabled: boolean;
  payoutFrequency: BonusPayoutFrequency;
  /** Estat del període en curs. `null` si no té el bonus actiu. */
  current: { periodLabel: string; units: number; amount: number } | null;
  /** Períodes tancables (el vigent i els anteriors), amb el payout ja fet si n'hi ha. */
  periods: { start: string; label: string; closedOn: string | null }[];
};

function WorkerRow({ row }: { row: WorkerRowData }) {
  const [state, action] = useActionState(updateWorkerBonusAction, {});
  const [payoutState, payoutAction] = useActionState(generatePayoutAction, {});
  const [enabled, setEnabled] = useState(row.enabled);

  return (
    <li className="border-b border-brand-border py-4 last:border-0">
      <form action={action} className="flex flex-wrap items-end gap-4">
        <input type="hidden" name="trainerId" value={row.trainerId} />
        <input type="hidden" name="enabled" value={enabled ? "true" : "false"} />

        <div className="min-w-40 flex-1">
          <p className="font-bold text-brand-dark">{row.name}</p>
          {row.current ? (
            <p className="text-xs text-brand-muted">
              {row.current.periodLabel}: {row.current.units} unitats ·{" "}
              {formatEur(row.current.amount)} acumulats
            </p>
          ) : (
            <p className="text-xs text-brand-muted">Sense bonus actiu</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`Bonus actiu per a ${row.name}`}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple ${
              enabled ? "bg-brand-purple" : "bg-brand-border"
            } ${TAP}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-brand-muted">Bonus actiu</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Freqüència
          </span>
          <select
            name="payoutFrequency"
            defaultValue={row.payoutFrequency}
            className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
          >
            <option value="annual">Anual</option>
            <option value="biennial">Biennal (cada 2 anys)</option>
          </select>
        </label>

        <SubmitButton>Desar</SubmitButton>

        {state.error && <p className="w-full text-xs text-error">{state.error}</p>}
        {state.ok && <p className="w-full text-xs text-success">Configuració desada.</p>}
      </form>

      {row.enabled && row.periods.length > 0 && (
        <form action={payoutAction} className="mt-2 flex flex-wrap items-center gap-3">
          <input type="hidden" name="trainerId" value={row.trainerId} />
          <select
            name="periodStart"
            defaultValue={row.periods[0].start}
            aria-label={`Període a tancar de ${row.name}`}
            className="rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs outline-none focus:border-brand-purple"
          >
            {row.periods.map((p) => (
              <option key={p.start} value={p.start}>
                {p.label}
                {p.closedOn ? " · ja tancat" : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className={`rounded-lg border border-brand-border px-3 py-1.5 text-xs font-bold text-brand-purple transition-colors hover:border-brand-purple ${TAP}`}
          >
            Tancar i generar payout
          </button>
          <span className="text-xs text-brand-muted">
            Un període tancat no es pot tornar a generar.
          </span>
          {payoutState.error && (
            <span className="text-xs text-error">{payoutState.error}</span>
          )}
          {payoutState.ok && (
            <span className="text-xs text-success">Bonus tancat i desat.</span>
          )}
        </form>
      )}
    </li>
  );
}

export function BonusWorkersEditor({ rows }: { rows: WorkerRowData[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-brand-muted">
        Encara no hi ha cap professional donat d&apos;alta.
      </p>
    );
  }

  return (
    <ul className="rounded-2xl border border-brand-border bg-white px-5">
      {rows.map((row) => (
        <WorkerRow key={row.trainerId} row={row} />
      ))}
    </ul>
  );
}
