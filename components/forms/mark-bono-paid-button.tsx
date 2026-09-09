"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import type { BonoStatus, ServiceType } from "@/types/database";

/**
 * Cobrar un bo, en dos temps.
 *
 * El primer clic no cobra res: obre el resum del que passarà. Cobrar activa el
 * bo, anota un pagament en efectiu, genera les recompenses de referit si en
 * toquen i reprèn la subscripció si el bo n'era d'una —quatre coses que no es
 * desfan des de cap pantalla—. Abans n'hi havia prou amb un clic despistat a la
 * fila equivocada.
 *
 * VIU EN UN SOL LLOC PERQUÈ EL TEXT HA DE DIR EL MATEIX A LES DUES ÀREES
 *
 * El fan servir la taula de bons de l'administració i la fitxa del client del
 * professional. Amb un diàleg a cada banda, el dia que canviï el que fa
 * `markBonoPaid` només se n'assabentaria un dels dos.
 *
 * Els tres casos que ja distingia el botó de l'admin es mantenen: un bo pendent
 * es cobra i prou; un de decaigut es cobra i es recupera; i un de decaigut que
 * ja ha passat de data només es cobra, perquè tornaria a caducar tot seguit.
 * L'explicació de cada cas era un `title` que només veia qui hi passava el
 * ratolí per sobre; ara és la descripció del diàleg, que la llegeix tothom.
 */
export function MarkBonoPaidButton({
  action,
  bonoId,
  clientName,
  serviceType,
  price,
  remainingSessions,
  totalSessions,
  status,
  expired = false,
}: {
  /** L'acció de servidor de cada àrea: la seva RLS i les seves rutes a revalidar. */
  action: (formData: FormData) => void | Promise<void>;
  bonoId: string;
  /** Sense nom no es pinta la fila: a la fitxa del client ja se sap de qui és. */
  clientName?: string;
  serviceType: ServiceType;
  price: number;
  remainingSessions: number;
  totalSessions: number;
  status: BonoStatus;
  /** Decaigut i, a més, ja passat de data. El dia el mana el servidor. */
  expired?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const isUnpaid = status === "unpaid";
  const label = !isUnpaid
    ? "Marcar com pagat"
    : expired
      ? "Només cobrar"
      : "Cobrar i recuperar";

  const description = !isUnpaid
    ? "Encara no s'ha cobrat res. En confirmar, el bo passa a actiu, les seves sessions queden disponibles a l'instant i s'anota un pagament en efectiu."
    : expired
      ? "El cobrament s'anota i, si el bo és d'una subscripció, la torna a posar en marxa. El bo NO es recupera: ja ha passat de data."
      : "Recupera el bo amb les sessions que li quedaven. Les reserves que es van cancel·lar en decaure NO tornen: s'han de tornar a demanar.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap text-white ${
          isUnpaid
            ? "bg-brand-orange hover:opacity-90"
            : "bg-brand-purple hover:bg-brand-purple-light"
        } ${TAP}`}
      >
        {label}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmes el cobrament?"
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
              <SubmitButton pendingLabel="Cobrant…">Sí, {label.toLowerCase()}</SubmitButton>
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
            <dt className="text-brand-muted">Sessions</dt>
            <dd className="text-right font-bold text-brand-dark">
              {remainingSessions} / {totalSessions}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Import a cobrar</dt>
            <dd className="text-right text-lg font-bold text-brand-purple">
              {formatEur(price)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-brand-muted">
          El pagament s&apos;anota com a efectiu. Un cop fet no es pot desfer des
          d&apos;aquí: si t&apos;equivoques de bo, cal avisar
          l&apos;administració.
        </p>
      </ConfirmDialog>
    </>
  );
}
