"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CounterMethodChoice } from "@/components/forms/counter-method-choice";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import type { BonoStatus, PaymentMethod, ServiceType } from "@/types/database";

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
/** El que torna l'acció: el motiu si no s'ha cobrat, `done` si sí. */
export type MarkPaidState = { error: string | null; done?: boolean };

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
  admin = false,
  fullWidth = false,
}: {
  /** L'acció de servidor de cada àrea: la seva RLS i les seves rutes a revalidar. */
  action: (prev: MarkPaidState, formData: FormData) => Promise<MarkPaidState>;
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
  /**
   * Qui cobra. Només canvia què fer si t'equivoques: l'admin ho esmena ell
   * mateix; el professional ho ha de dir a l'administració.
   */
  admin?: boolean;
  /** A la targeta del mòbil: 44 px i a tot l'ample. A la taula, el petit. */
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Cada vegada que s'obre torna a ser efectiu: és el cas de cada dia, i un
  // «targeta» que quedés triat d'un cobrament anterior s'anotaria malament.
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const formId = useId();
  const [state, formAction] = useActionState(action, { error: null });
  // Cobrat: es tanca. Si no, el diàleg queda obert amb el motiu.
  useEffect(() => {
    if (state.done) setOpen(false);
  }, [state]);
  // En tancar el diàleg, el motiu d'abans ja no s'ensenya en tornar-lo a obrir.
  const [dismissed, setDismissed] = useState<MarkPaidState | null>(null);
  const close = () => {
    setDismissed(state);
    setOpen(false);
  };
  const error = state !== dismissed ? state.error : null;

  const isUnpaid = status === "unpaid";
  const label = !isUnpaid
    ? "Marcar com pagat"
    : expired
      ? "Només cobrar"
      : "Cobrar i recuperar";

  const description = !isUnpaid
    ? "Encara no s'ha cobrat res. En confirmar, el bo passa a actiu, les seves sessions queden disponibles a l'instant i s'anota el pagament amb el mètode que triïs."
    : expired
      ? "El cobrament s'anota i, si el bo és d'una subscripció, la torna a posar en marxa. El bo NO es recupera: ja ha passat de data."
      : "Recupera el bo amb les sessions que li quedaven. Les reserves que es van cancel·lar en decaure NO tornen: s'han de tornar a demanar.";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMethod("cash");
          setOpen(true);
        }}
        // El mateix lila per a «Marcar com pagat» i «Cobrar i recuperar»: el
        // text ja diu quin és quin, i el taronja és només dels grups (pas 7).
        className={`${fullWidth ? "h-11 w-full rounded-lg px-4 text-sm" : "rounded-md px-2.5 py-1 text-xs"} bg-brand-purple font-bold whitespace-nowrap text-white hover:bg-brand-purple-light ${TAP}`}
      >
        {label}
      </button>

      <ConfirmDialog
        open={open}
        onClose={close}
        title="Confirmes el cobrament?"
        description={description}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={close}
            >
              No, torna
            </Button>
            <form id={formId} action={formAction}>
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

        <CounterMethodChoice form={formId} value={method} onChange={setMethod} />

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-error/5 px-3 py-2 text-sm font-bold text-error">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-brand-muted">
          Un cop fet no es pot desfer des d&apos;aquí.{" "}
          {admin
            ? "Si t'equivoques de bo, anul·la'l i corregeix el pagament a Pagaments."
            : "Si t'equivoques de bo, cal avisar l'administració."}
        </p>
      </ConfirmDialog>
    </>
  );
}
