"use client";

import { useFormStatus } from "react-dom";
import { clsx } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/**
 * El germà de `SubmitButton` per als botons d'ENLLAÇ: els d'acció petits, en
 * majúscules i sense fons, que l'app fa servir dins de files ("Desar",
 * "Esborrar", "Treure"…).
 *
 * Mateixa feina i mateix motiu que allà: mentre l'enviament està en vol,
 * rodeta i `disabled`. Sense això la fila no diu res entre el clic i el
 * repintat, i qui no veu resposta torna a clicar.
 *
 * No es fa amb `SubmitButton` perquè aquell pinta un `Button` amb fons i
 * farciment, i aquí trencaria la fila. L'única diferència és la forma.
 */
export function PendingTextButton({
  children,
  pendingLabel,
  className,
  disabled,
  title,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  /** Motiu propi per bloquejar-lo, a més de l'enviament en curs. */
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      title={title}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide uppercase",
        className,
      )}
    >
      {pending ? (
        <>
          <Spinner size={12} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
