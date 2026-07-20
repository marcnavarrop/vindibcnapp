import { formatEur } from "@/lib/labels";
import type { EffectivePrice } from "@/lib/data/promotions";

/**
 * Mostra el preu d'un paquet amb estil "tienda":
 * - Sense oferta: preu en color de marca normal.
 * - Amb oferta: preu original tatxat en gris + preu final en taronja + badge "-X%"/"-X€".
 */
export function PriceDisplay({
  ep,
  size = "md",
  showPerSession,
}: {
  ep: EffectivePrice;
  /** "sm" per a llistats compactes, "md" per a targetes */
  size?: "sm" | "md";
  /** Si > 1 sessió, mostra preu/sessió calculat del preu final */
  showPerSession?: number;
}) {
  const textFinal = size === "sm" ? "text-sm font-bold" : "font-bold";
  const textOrig  = size === "sm" ? "text-xs" : "text-sm";

  if (!ep.hasDiscount) {
    return (
      <span className={`${textFinal} text-brand-purple`}>
        {formatEur(ep.finalPrice)}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-1.5">
        <span
          className="rounded-full bg-brand-orange px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
        >
          {ep.discountLabel}
        </span>
        <span className={`${textFinal} text-brand-orange`}>
          {formatEur(ep.finalPrice)}
        </span>
      </span>
      <span className={`${textOrig} text-brand-muted line-through`}>
        {formatEur(ep.originalPrice)}
      </span>
      {showPerSession !== undefined && showPerSession > 1 && (
        <span className="text-xs text-brand-muted">
          {formatEur(ep.finalPrice / showPerSession)}/sessió
        </span>
      )}
    </span>
  );
}
