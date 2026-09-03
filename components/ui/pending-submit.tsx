"use client";

import { TAP, clsx } from "@/lib/utils";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

/**
 * Botó d'enviament amb estat d'espera, per quan cal un aspecte propi.
 *
 * És el germà de `SubmitButton`: aquell pinta el `Button` de sempre, i aquest
 * deixa que qui el fa servir posi les classes, per als llocs que ja tenien un
 * botó amb un altre estil (el modal de reserva, sense majúscules).
 *
 * Ha d'anar DINS del `<form>`: `useFormStatus` llegeix l'enviament del
 * formulari que el conté.
 */
export function PendingSubmit({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  /** Motiu propi per bloquejar-lo (p. ex. condicions sense acceptar). */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={clsx(className, TAP)}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
