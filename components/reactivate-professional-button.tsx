"use client";

import { useActionState, useState } from "react";
import {
  reactivateProfessionalAction,
  type ReactivateState,
} from "@/app/(admin)/admin/entrenadors/baixa-actions";
import { TAP } from "@/lib/utils";

/**
 * «Reactivar» un professional donat de baixa (0128), amb un segon clic per
 * confirmar. Els clients, reserves i esperes que es van resoldre en la baixa no
 * tornen: es diu abans de confirmar.
 */
export function ReactivateProfessionalButton({
  id,
  name,
  compact,
}: {
  id: string;
  name: string;
  /** A la llista: més petit, i el text explicatiu a sota. */
  compact?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(
    reactivateProfessionalAction.bind(null, id),
    {} as ReactivateState,
  );

  if (state.ok)
    return (
      <p className="text-sm text-success" data-reactivated>
        Reactivat.{state.warning ? ` ${state.warning}` : ""}
      </p>
    );

  const btn = compact
    ? "text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline"
    : "rounded-lg border border-brand-purple px-4 py-2 text-sm font-bold text-brand-purple hover:bg-brand-purple/5";

  return (
    <div className="flex flex-col gap-2">
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className={`${btn} ${TAP} self-start`}>
          Reactivar
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-2 text-sm text-brand-charcoal">
          <p>
            {name} tornarà a poder entrar i la seva disponibilitat es tornarà a oferir. Els clients, reserves i
            esperes que es van resoldre en donar-lo de baixa no tornen.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className={`rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-40 ${TAP}`}
            >
              {pending ? "Reactivant…" : `Sí, reactivar ${name}`}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className={`text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
            >
              No
            </button>
          </div>
        </form>
      )}
      {state.error && (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
