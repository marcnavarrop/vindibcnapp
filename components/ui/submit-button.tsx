"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Botón de envío para formularios con Server Actions: se deshabilita y muestra
 * una rueda de espera y un texto de carga mientras la acción está en curso.
 */
export function SubmitButton({
  children,
  pendingLabel = "Desant…",
  variant,
  className,
  disabled,
  formAction,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  /** Motiu propi per bloquejar-lo, a més de l'enviament en curs. */
  disabled?: boolean;
  /**
   * Server action pròpia d'aquest botó, quan el mateix formulari té més d'una
   * sortida (p. ex. pagar al centre o pagar amb targeta). `useFormStatus` mira
   * el formulari, no el botó, així que la rodeta funciona igual amb totes dues.
   */
  formAction?: React.ComponentProps<typeof Button>["formAction"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      variant={variant}
      className={className}
      formAction={formAction}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
