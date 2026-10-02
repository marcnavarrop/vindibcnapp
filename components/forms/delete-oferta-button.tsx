"use client";

import { deleteOfertaAction } from "@/app/(admin)/admin/ofertes/actions";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { TAP } from "@/lib/utils";

/**
 * Eliminar una oferta. Abans preguntava amb el `window.confirm` del navegador,
 * que no s'assembla a res més de l'app i, dins d'algunes vistes incrustades, ni
 * tan sols surt. Ara pregunta com la resta d'esborrats.
 *
 * Els bons ja comprats no canvien: el preu queda desat a cada bo.
 */
export function DeleteOfertaButton({ id }: { id: string }) {
  return (
    <ConfirmInline
      compact
      action={deleteOfertaAction}
      fields={{ id }}
      trigger="Eliminar"
      triggerClassName={`text-xs font-bold tracking-wide text-error uppercase hover:opacity-70 ${TAP}`}
      question="Eliminar aquesta oferta?"
      consequence="Els clients deixen de veure el descompte. Els bons ja comprats no canvien."
      confirmLabel="Sí, elimina"
      pendingLabel="Eliminant…"
    />
  );
}
