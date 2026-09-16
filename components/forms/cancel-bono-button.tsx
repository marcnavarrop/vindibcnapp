"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import type { BonoStatus, ServiceType } from "@/types/database";

/**
 * Anul·lar un bo, en dos temps.
 *
 * VIU EN UN SOL LLOC PEL MATEIX MOTIU QUE `MarkBonoPaidButton`
 *
 * El fan servir les dues taules de bons i la fitxa del client. Anul·lar no es
 * desfà des de cap pantalla, i el text que ho explica ha de dir el mateix a les
 * tres bandes.
 *
 * ELS DOS CASOS QUE DISTINGEIX
 *
 * Un bo PENDENT no s'ha cobrat: anul·lar-lo no mou cap número i el diàleg ho
 * pot dir en una línia. Un bo ACTIU sí que s'ha cobrat, i el diàleg ha
 * d'avisar-ho abans de res: els diners segueixen anotats i la devolució es fa
 * fora de l'app. Qui només pot anul·lar pendents no veurà mai el segon text
 * —el botó no li surt—, però el component el porta igualment perquè és la
 * mateixa peça la que serveix l'admin.
 *
 * QUI DECIDEIX SI ES POT: no és aquest botó. La regla viu a `cancelBlockFor`
 * i la pantalla només pinta el botó quan no hi ha cap impediment; el servidor
 * hi torna a passar i la RLS de la 0085 també.
 */
export function CancelBonoButton({
  action,
  bonoId,
  clientName,
  serviceType,
  price,
  totalSessions,
  status,
}: {
  /** L'acció de servidor de cada àrea: el seu `isAdmin` i les seves rutes. */
  action: (formData: FormData) => void | Promise<void>;
  bonoId: string;
  /** Sense nom no es pinta la fila: a la fitxa del client ja se sap de qui és. */
  clientName?: string;
  serviceType: ServiceType;
  price: number;
  totalSessions: number;
  status: BonoStatus;
}) {
  const [open, setOpen] = useState(false);
  const cobrat = status === "active";

  const description = cobrat
    ? "Aquest bo JA ESTÀ COBRAT. En anul·lar-lo, el bo deixa de valer però el cobrament segueix anotat al llibre: a l'app no hi ha manera de registrar una devolució, i tornar els diners s'ha de fer fora."
    : "Encara no s'ha cobrat res, així que anul·lar-lo no mou cap número. El bo deixa de valer i les seves sessions ja no es podran reservar.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md border border-brand-border px-2.5 py-1 text-xs font-bold whitespace-nowrap text-brand-muted hover:border-error hover:text-error ${TAP}`}
      >
        Anul·lar
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmes l'anul·lació?"
        description={description}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel·lar
            </Button>
            <form action={action}>
              <input type="hidden" name="bonoId" value={bonoId} />
              <SubmitButton pendingLabel="Anul·lant…">
                Sí, anul·lar el bo
              </SubmitButton>
            </form>
          </>
        }
      >
        <dl className="flex flex-col gap-2 rounded-xl bg-brand-bg p-4 text-sm">
          {clientName && (
            <div className="flex justify-between gap-3">
              <dt className="text-brand-muted">Client</dt>
              <dd className="text-right font-bold text-brand-dark">
                {clientName}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Servei</dt>
            <dd className="text-right font-bold text-brand-dark">
              {SERVICE_LABELS[serviceType]}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Sessions que es perden</dt>
            <dd className="text-right font-bold text-brand-dark">
              {totalSessions}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">
              {cobrat ? "Import ja cobrat" : "Import (sense cobrar)"}
            </dt>
            <dd className="text-right text-lg font-bold text-brand-purple">
              {formatEur(price)}
            </dd>
          </div>
        </dl>

        {/*
          Només si n'hi ha. La recompensa es va gastar en comprar el bo i
          torna al client en anul·lar-lo: el descompte se'l va guanyar portant
          algú, i no el perd perquè després s'anul·li la compra on el va fer
          servir. No se sap des d'aquí si aquest bo en portava cap, així que es
          diu en condicional i sense prometre res que no es pugui complir.
        */}
        <p className="mt-4 text-xs text-brand-muted">
          Si en comprar-lo es va gastar un descompte de referit, li torna.
          Un cop anul·lat no es pot recuperar des d&apos;aquí: caldria vendre-li
          un bo nou.
        </p>
      </ConfirmDialog>
    </>
  );
}
