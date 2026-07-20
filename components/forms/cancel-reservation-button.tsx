"use client";

import { useActionState } from "react";
import { cancelOwnReservationAction } from "@/app/(client)/client/reservas/actions";

/**
 * Botó de cancel·lació d'una reserva del client.
 * - Si la reserva és dins el termini mínim, mostra un text explicatiu en lloc del botó.
 * - Si s'intenta cancel·lar i el servidor rebutja, mostra el missatge d'error.
 */
export function CancelReservationButton({
  id,
  scheduledAt,
  minCancellationHours,
  minMs,
  className = "",
}: {
  id: string;
  scheduledAt: string;
  minCancellationHours: number;
  minMs: number;
  className?: string;
}) {
  const [state, action] = useActionState(cancelOwnReservationAction, {});
  const canCancel =
    minCancellationHours === 0 ||
    new Date(scheduledAt).getTime() - Date.now() >= minMs;

  if (!canCancel) {
    return (
      <span className={`text-xs text-brand-muted italic ${className}`}>
        Ja no es pot cancel·lar
      </span>
    );
  }

  return (
    <div className={className}>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-error hover:bg-error/10"
        >
          Cancel·lar
        </button>
      </form>
      {state.error && (
        <p className="mt-1 max-w-[16rem] text-xs text-error">{state.error}</p>
      )}
    </div>
  );
}
