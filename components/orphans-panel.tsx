"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { OrphansList } from "@/components/orphans-confirm";
import type { Orphans } from "@/lib/data/availability-orphans";

export type OrphansPanelState = { notice?: string; error?: string };

/**
 * «Reserves fora de la teva disponibilitat»: tot el que ARA cau fora.
 *
 * Hi surt el que un canvi va deixar orfe i es va decidir mantenir, el que ja
 * era orfe abans que existís el pas de confirmació, i el que una cancel·lació
 * fallida va deixar reservat. És, a més, el camí de tornar-ho a provar.
 *
 * Aquí les caselles surten DESMARCADES, al revés que al pas de confirmació:
 * el que hi ha al plafó sovint és a posta, i cancel·lar-ho ha de ser un gest.
 */
export function OrphansPanel({
  orphans,
  action,
  own,
}: {
  orphans: Orphans;
  action: (prev: OrphansPanelState, fd: FormData) => Promise<OrphansPanelState>;
  /** L'agenda és de qui mira (professional) o d'un altre (admin). */
  own: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const n =
    orphans.reservations.length + orphans.trials.length + orphans.waitlist.length;

  if (n === 0 && !state.notice && !state.error) return null;

  return (
    <section className="mb-8 rounded-2xl border border-brand-orange/40 bg-white p-6">
      <h2 className="mb-1 text-lg font-bold text-brand-dark">
        {own
          ? "Reserves fora de la teva disponibilitat"
          : "Reserves fora de la disponibilitat"}
      </h2>
      {n > 0 ? (
        <form action={formAction}>
          <p className="mb-4 text-sm text-brand-muted">
            {n === 1 ? "Hi ha 1 compromís" : `Hi ha ${n} compromisos`} en
            franges que ja no són dins de l&apos;horari o que un bloqueig tapa.
            Marca els que vulguis cancel·lar: es tornarà la sessió al bo i
            s&apos;avisarà cada client per correu.
          </p>
          <div className="mb-4">
            <OrphansList orphans={orphans} defaultChecked={false} />
          </div>
          {state.error && (
            <p role="alert" className="mb-3 text-sm text-error">
              {state.error}
            </p>
          )}
          <SubmitButton>Cancel·lar les marcades</SubmitButton>
        </form>
      ) : (
        state.error && (
          <p role="alert" className="text-sm text-error">
            {state.error}
          </p>
        )
      )}
      {state.notice && (
        <p className="mt-3 text-sm text-success">{state.notice}</p>
      )}
    </section>
  );
}
