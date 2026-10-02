"use client";

import { ConfirmInline } from "@/components/ui/confirm-inline";

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
 *
 * La mecànica és la de `ConfirmInline`, que va néixer d'aquí i ara fan servir
 * tots els esborrats de l'equip. Aquest component només hi posa les paraules.
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
  return (
    <ConfirmInline
      action={action}
      fields={{ id }}
      trigger="Cancel·lar"
      question="Cancel·lar aquesta reserva?"
      consequence="Si anava amb bo, la sessió hi torna, i el client rebrà un correu."
      confirmLabel="Sí, cancel·la"
      pendingLabel="Cancel·lant…"
      groupLabel="Confirmar la cancel·lació"
      pending={pending}
      disabled={disabled}
      compact={compact}
    />
  );
}
