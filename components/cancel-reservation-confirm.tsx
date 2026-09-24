"use client";

import { useState } from "react";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";

/**
 * CANCEL·LAR AMB CONFIRMACIÓ, per a l'equip (fitxa del calendari i llista).
 *
 * Abans el botó «Cancel·lar» enviava de cop: un toc de més al mòbil i la
 * reserva era fora, la sessió tornava al bo i el client rebia el correu. Ara el
 * primer toc només pregunta, i diu què passarà. El client ja ho tenia així.
 *
 * El que diu és el que fa `cancelReservation` (lib/data/reservations.ts): torna
 * la sessió al bo si n'hi havia, avisa el client per correu (sempre: no es pot
 * desactivar) i ofereix la franja a qui esperi a la llista.
 */
export function CancelReservationConfirm({
  id,
  action,
  pending,
  disabled,
  compact = false,
}: {
  id: string;
  action: (formData: FormData) => void;
  pending: boolean;
  disabled: boolean;
  /** Fila de llista: botons petits i el text a la dreta. */
  compact?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  const button = compact
    ? `whitespace-nowrap rounded-md border border-brand-border px-2 py-1 text-xs font-bold ${TAP}`
    : `w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold ${TAP_SURFACE}`;

  if (!asking && !pending)
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={clsx(button, "text-error hover:bg-error/10 disabled:opacity-60")}
      >
        Cancel·lar
      </button>
    );

  return (
    <div
      role="group"
      aria-label="Confirmar la cancel·lació"
      className={clsx("flex flex-col gap-1.5", compact ? "items-end" : "w-full")}
    >
      <p
        className={clsx(
          "text-brand-charcoal",
          compact ? "max-w-[15rem] text-right text-xs" : "text-sm",
        )}
      >
        <span className="font-bold">Cancel·lar aquesta reserva?</span>{" "}
        Si anava amb bo, la sessió hi torna, i el client rebrà un correu.
      </p>
      <div className={clsx("flex gap-1.5", !compact && "w-full")}>
        <form action={action} className={clsx(!compact && "flex-1")}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pending}
            className={clsx(
              button,
              "border-error bg-error text-white hover:opacity-90 disabled:opacity-60",
            )}
          >
            {pending ? "Cancel·lant…" : "Sí, cancel·la"}
          </button>
        </form>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(false)}
          className={clsx(
            button,
            !compact && "flex-1",
            "text-brand-muted hover:text-brand-dark disabled:opacity-60",
          )}
        >
          No, torna
        </button>
      </div>
    </div>
  );
}
