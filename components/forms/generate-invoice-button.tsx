"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { generateInvoiceAction } from "@/app/(admin)/admin/facturacio/actions";
import { SERVICE_LABELS, formatEur, formatDate } from "@/lib/labels";
import type { SettlementBreakdownLine } from "@/types/database";

/**
 * Generació de la factura en dos temps.
 *
 * El primer clic no desa ni envia res: només obre el resum del que passarà.
 * L'acció de negoci —desar la liquidació, emetre el PDF i avisar el
 * professional— no s'executa fins que es confirma, perquè un cop enviada no hi
 * ha marxa enrere des de la UI.
 *
 * Al formulari només hi viatgen el professional i el període: els imports que
 * es veuen aquí són informatius i el servidor els torna a calcular.
 */
export function GenerateInvoiceButton({
  trainerId,
  trainerName,
  periodStart,
  periodEnd,
  lines,
  total,
  existingInvoice,
}: {
  trainerId: string;
  trainerName: string;
  periodStart: string;
  periodEnd: string;
  lines: SettlementBreakdownLine[];
  total: number;
  /** Ja hi ha una liquidació desada per a aquest mateix professional i període. */
  existingInvoice: boolean;
}) {
  const [state, action] = useActionState(generateInvoiceAction, {});
  const [open, setOpen] = useState(false);

  // Un cop feta, el diàleg sobra: el resultat es llegeix a la pàgina.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button type="button" onClick={() => setOpen(true)}>
        Generar factura
      </Button>

      {state.error && <span className="text-sm text-error">{state.error}</span>}
      {state.ok && (
        <span className="text-sm text-success">
          Factura generada i enviada al professional.
          {state.warning ? ` ${state.warning}` : ""}
        </span>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          existingInvoice
            ? "Aquest període ja té factura"
            : "Revisa la factura abans d'enviar-la"
        }
        description={
          existingInvoice
            ? "Un període només pot tenir una factura, i aquest ja en té una."
            : "Encara no s'ha desat ni enviat res. En confirmar es desarà la liquidació, es generarà el document i s'avisarà el professional per correu."
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {existingInvoice ? "Tancar" : "Cancel·lar"}
            </Button>
            {/* Amb una factura ja generada la base de dades ho rebutjarà: val
                més no oferir un botó condemnat a fallar. */}
            {!existingInvoice && (
              <form action={action}>
                <input type="hidden" name="trainerId" value={trainerId} />
                <input type="hidden" name="periodStart" value={periodStart} />
                <input type="hidden" name="periodEnd" value={periodEnd} />
                <SubmitButton pendingLabel="Generant…">
                  Sí, generar i enviar
                </SubmitButton>
              </form>
            )}
          </>
        }
      >
        <dl className="flex flex-col gap-2 rounded-xl bg-brand-bg p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Professional</dt>
            <dd className="text-right font-bold text-brand-dark">{trainerName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Període</dt>
            <dd className="text-right font-bold text-brand-dark">
              {formatDate(periodStart)} – {formatDate(periodEnd)}
            </dd>
          </div>
        </dl>

        <ul className="mt-4 divide-y divide-brand-border">
          {lines.map((l) => (
            <li
              key={l.serviceType}
              className="flex items-baseline justify-between gap-3 py-2 text-sm"
            >
              <span className="text-brand-charcoal">
                {l.sessions} {l.sessions === 1 ? "sessió" : "sessions"}{" "}
                {SERVICE_LABELS[l.serviceType]}
                {l.rate !== null && (
                  <span className="text-brand-muted"> × {formatEur(l.rate)}</span>
                )}
              </span>
              <span className="shrink-0 font-bold text-brand-dark">
                {formatEur(l.amount)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-brand-purple/30 pt-3">
          <span className="text-sm font-bold tracking-wide text-brand-muted uppercase">
            Total
          </span>
          <span className="text-2xl font-bold text-brand-purple">
            {formatEur(total)}
          </span>
        </div>

        {existingInvoice ? (
          <p className="mt-4 rounded-lg bg-brand-orange/10 p-3 text-xs text-brand-orange">
            Ja hi ha una liquidació desada d&apos;aquest professional per a
            aquest mateix període, i no se&apos;n pot generar una segona. Si cal
            refer-la, esborra abans la liquidació existent.
          </p>
        ) : (
          <p className="mt-4 text-xs text-brand-muted">
            El document que es genera porta imprès l&apos;avís de
            provisionalitat: és un càlcul intern del centre, no un document amb
            validesa fiscal fins que l&apos;assessoria confirmi el format
            oficial.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
