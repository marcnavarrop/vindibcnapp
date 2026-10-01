"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  cancelTrainerEmailChangeAction,
  requestTrainerEmailChangeAction,
  type TrainerEmailState,
} from "@/app/(admin)/admin/entrenadors/email-actions";
import type { PendingEmailChange } from "@/lib/data/email-change";
import { TAP } from "@/lib/utils";

/**
 * El correu d'ACCÉS d'un professional, des de la seva fitxa.
 *
 * L'admin no el canvia: el DEMANA. S'envia un enllaç al correu nou i el canvi
 * només es fa quan el professional hi fa clic (així es comprova que la bústia
 * és seva). Al correu vell li arriba un avís sense cap enllaç. Mateix flux que
 * el del client (`lib/data/email-change.ts`), iniciat per l'admin.
 */
export function TrainerEmailForm({
  trainerId,
  currentEmail,
  pending,
}: {
  trainerId: string;
  currentEmail: string;
  pending: PendingEmailChange | null;
}) {
  const [state, formAction] = useActionState(
    requestTrainerEmailChangeAction.bind(null, trainerId),
    {} as TrainerEmailState,
  );

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6" data-trainer-email>
      <div>
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">Correu d&apos;accés</h2>
        <p className="mt-1 text-xs text-brand-muted">
          És el correu amb què entra a l&apos;app i on li arriben els avisos. Per canviar-lo, s&apos;envia un enllaç al
          correu nou i el canvi es fa quan el professional hi fa clic. Al correu d&apos;ara li arriba un avís. Després
          entra amb el correu nou i la mateixa contrasenya.
        </p>
      </div>

      <p className="text-sm">
        <span className="text-brand-muted">Ara: </span>
        <span className="font-bold text-brand-dark" data-current-email>
          {currentEmail}
        </span>
      </p>

      {pending && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5" data-pending-email>
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">Pendent de confirmar</span>
          <p className="text-sm text-brand-charcoal">
            S&apos;ha enviat un enllaç a <strong>{pending.newEmail}</strong>. El correu no canvia fins que el
            professional hi fa clic (val 24 hores).
          </p>
          <form action={cancelTrainerEmailChangeAction}>
            <input type="hidden" name="trainerId" value={trainerId} />
            <button type="submit" className={`text-sm font-bold text-brand-purple hover:text-brand-orange ${TAP}`}>
              Anul·lar l&apos;enllaç
            </button>
          </form>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <div>
          <label htmlFor="newEmail" className="mb-1 block text-sm font-bold text-brand-dark">
            Correu nou
          </label>
          <input
            id="newEmail"
            name="newEmail"
            type="email"
            required
            autoComplete="off"
            className="w-full max-w-md rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
          />
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-error" data-email-error>
            {state.error}
          </p>
        )}
        {state.sentTo && (
          <p role="status" className="text-sm text-success" data-email-sent>
            Enllaç enviat a {state.sentTo}. Avisa el professional que el confirmi des d&apos;aquesta bústia.
          </p>
        )}
        <div>
          <SubmitButton pendingLabel="Enviant…">Enviar l&apos;enllaç de confirmació</SubmitButton>
        </div>
      </form>
    </section>
  );
}
