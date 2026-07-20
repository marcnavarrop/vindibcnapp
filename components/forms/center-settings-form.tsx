"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCenterSettingsAction } from "@/app/(admin)/admin/configuracio/center-actions";
import type { CenterSettings } from "@/lib/data/center-settings";

export function CenterSettingsForm({ settings }: { settings: CenterSettings }) {
  const [state, action] = useActionState(updateCenterSettingsAction, {});

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6"
    >
      <div>
        <label
          htmlFor="minCancellationHours"
          className="mb-1 block text-sm font-bold text-brand-dark"
        >
          Hores mínimes per cancel·lar una reserva
        </label>
        <p className="mb-3 text-xs text-brand-muted">
          El client no podrà cancel·lar si la sessió és en menys d&apos;aquest
          nombre d&apos;hores. Posa 0 per permetre cancel·lació fins al darrer
          moment.
        </p>
        <div className="flex items-center gap-3">
          <input
            id="minCancellationHours"
            name="minCancellationHours"
            type="number"
            min={0}
            max={168}
            step={1}
            required
            defaultValue={settings.minCancellationHours}
            className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
          />
          <span className="text-sm text-brand-muted">hores</span>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-error">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-sm text-success">Desat correctament.</p>
      )}

      <div>
        <SubmitButton>Desar configuració</SubmitButton>
      </div>
    </form>
  );
}
