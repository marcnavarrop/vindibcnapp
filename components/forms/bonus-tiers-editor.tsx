"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveTiersAction } from "@/app/(admin)/admin/facturacio/bonus-actions";
import { TAP } from "@/lib/utils";

export type TierRowData = {
  minUnits: number;
  maxUnits: number | null;
  ratePerUnit: number;
};

/**
 * Editor del joc de trams sencer: es desa tot de cop, perquè els trams només
 * tenen sentit com a conjunt encadenat (el màxim d'un és el mínim del següent).
 */
export function BonusTiersEditor({ tiers }: { tiers: TierRowData[] }) {
  const [state, action] = useActionState(saveTiersAction, {});
  const [rows, setRows] = useState<TierRowData[]>(
    tiers.length > 0 ? tiers : [{ minUnits: 0, maxUnits: null, ratePerUnit: 1 }],
  );

  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      // El nou tram arrenca on acabava l'anterior; si l'anterior era obert,
      // se li posa un sostre provisional perquè el conjunt segueixi encadenat.
      const start = last.maxUnits ?? last.minUnits + 50;
      const next = [...prev];
      next[next.length - 1] = { ...last, maxUnits: start };
      next.push({ minUnits: start, maxUnits: null, ratePerUnit: last.ratePerUnit });
      return next;
    });
  }

  function removeRow(i: number) {
    setRows((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((_, idx) => idx !== i);
      // L'últim sempre queda obert: si s'esborra el de sota, el nou últim
      // hereta el sostre infinit.
      next[next.length - 1] = { ...next[next.length - 1], maxUnits: null };
      return next;
    });
  }

  function update(i: number, patch: Partial<TierRowData>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <form action={action} className="rounded-2xl border border-brand-border bg-white p-5">
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Des de
              </span>
              <input
                name="minUnits"
                type="number"
                min={0}
                step={0.5}
                required
                value={r.minUnits}
                onChange={(e) => update(i, { minUnits: Number(e.target.value) })}
                className="w-24 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Fins a
              </span>
              <input
                name="maxUnits"
                type="number"
                min={0}
                step={0.5}
                placeholder="Sense límit"
                value={r.maxUnits ?? ""}
                onChange={(e) =>
                  update(i, {
                    maxUnits: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-32 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                € / unitat
              </span>
              <input
                name="ratePerUnit"
                type="number"
                min={0}
                step={0.05}
                required
                value={r.ratePerUnit}
                onChange={(e) => update(i, { ratePerUnit: Number(e.target.value) })}
                className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </label>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className={`py-2 text-xs font-bold text-brand-muted underline hover:text-error ${TAP}`}
              >
                Treure
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className={`rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-brand-purple transition-colors hover:border-brand-purple ${TAP}`}
        >
          + Afegir tram
        </button>
        <SubmitButton>Desar trams</SubmitButton>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
        {state.ok && <span className="text-sm text-success">Trams desats.</span>}
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Els trams s&apos;encadenen: el màxim d&apos;un ha de ser el mínim del
        següent, i l&apos;últim es deixa sense límit. Es cobra per trams, com
        l&apos;IRPF: superar un llindar no recalcula al preu nou les unitats
        que hi ha per sota.
      </p>
    </form>
  );
}
