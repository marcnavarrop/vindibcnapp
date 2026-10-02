"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CounterMethodChoice } from "@/components/forms/counter-method-choice";
import type { MarkPaidState } from "@/components/forms/mark-bono-paid-button";
import { formatEur } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

/**
 * Cobrar un val de regal pagat al centre. Era un sol toc que anotava sempre
 * efectiu; ara és el mateix pas que cobrar un bo: un resum, com ha pagat
 * (efectiu ve marcat) i «Sí, marcar com pagat». El que no surt bé —per exemple,
 * que una altra pestanya ja l'hagi cobrat— es diu dins del diàleg.
 */
export function MarkVoucherPaidButton({
  action,
  voucherId,
  code,
  buyerName,
  packageName,
  price,
}: {
  action: (prev: MarkPaidState, formData: FormData) => Promise<MarkPaidState>;
  voucherId: string;
  code: string;
  buyerName: string;
  packageName: string;
  price: number;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [state, formAction] = useActionState(action, { error: null });
  const [dismissed, setDismissed] = useState<MarkPaidState | null>(null);
  const formId = useId();
  useEffect(() => {
    if (state.done) setOpen(false);
  }, [state]);
  const close = () => {
    setDismissed(state);
    setOpen(false);
  };
  const error = state !== dismissed ? state.error : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMethod("cash");
          setOpen(true);
        }}
        className={`rounded-md bg-brand-purple px-2.5 py-1 text-xs font-bold whitespace-nowrap text-white hover:bg-brand-purple-light ${TAP}`}
      >
        Marcar com pagat
      </button>

      <ConfirmDialog
        open={open}
        onClose={close}
        title="Confirmes el cobrament?"
        description="En confirmar, el val es pot bescanviar i s'anota el pagament amb el mètode que triïs."
        actions={
          <>
            <Button type="button" variant="outline" onClick={close}>
              No, torna
            </Button>
            <form id={formId} action={formAction}>
              <input type="hidden" name="voucherId" value={voucherId} />
              <SubmitButton pendingLabel="Cobrant…">Sí, marcar com pagat</SubmitButton>
            </form>
          </>
        }
      >
        <dl className="flex flex-col gap-2 rounded-xl bg-brand-bg p-4 text-sm">
          {[
            ["Val", code],
            ["Comprador", buyerName],
            ["Paquet", packageName],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-brand-muted">{k}</dt>
              <dd className="text-right font-bold text-brand-dark">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Import a cobrar</dt>
            <dd className="text-right text-lg font-bold text-brand-purple">{formatEur(price)}</dd>
          </div>
        </dl>

        <CounterMethodChoice form={formId} value={method} onChange={setMethod} />

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-error/5 px-3 py-2 text-sm font-bold text-error">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-brand-muted">
          Un cop fet no es pot desfer des d&apos;aquí. Si t&apos;equivoques de val,
          anul·la&apos;l i corregeix el pagament a Pagaments.
        </p>
      </ConfirmDialog>
    </>
  );
}
