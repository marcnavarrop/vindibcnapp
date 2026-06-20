import { clsx } from "@/lib/utils";

/**
 * Wordmark de la marca: "Vindi" + "BCN" en naranja de acento.
 * Usa la serif de marca (Lora). Sustituir por el logo real cuando exista.
 */
export function Wordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "font-display text-2xl font-bold tracking-tight text-brand-dark",
        className,
      )}
    >
      Vindi<span className="text-brand-orange">BCN</span>
    </span>
  );
}
