"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { generateSettlementAction } from "@/app/(admin)/admin/facturacio/actions";

/**
 * Desa el càlcul que hi ha a la pantalla. Només envia el professional i el
 * període: els imports els torna a calcular el servidor.
 */
export function GenerateSettlementButton({
  trainerId,
  periodStart,
  periodEnd,
}: {
  trainerId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const [state, action] = useActionState(generateSettlementAction, {});

  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="trainerId" value={trainerId} />
      <input type="hidden" name="periodStart" value={periodStart} />
      <input type="hidden" name="periodEnd" value={periodEnd} />
      <SubmitButton pendingLabel="Generant…">Generar liquidació</SubmitButton>
      {state.error && <span className="text-sm text-error">{state.error}</span>}
      {state.ok && (
        <span className="text-sm text-success">
          Liquidació desada. Queda fixada encara que canviïn les tarifes.
        </span>
      )}
    </form>
  );
}
