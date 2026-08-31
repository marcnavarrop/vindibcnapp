import { formatEur } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { EffectivePrice } from "@/lib/data/promotions";

/**
 * Mostra el preu d'un paquet amb estil "tienda":
 * - Sense oferta: preu en color de marca normal.
 * - Amb oferta: preu original tatxat en gris + preu final en taronja + badge "-X%"/"-X€".
 *
 * L'idioma entra per PROPIETAT i no per hook. Aquest component es pinta als dos
 * costats: dins de formularis de client ("use client") i dins de la pàgina de
 * serveis de l'admin, que és de servidor. `useLocale()` trencaria la segona i
 * `getLocale()` la primera; una propietat val per a totes dues. Qui el crida
 * des del client hi passa el seu `useLocale()`; l'admin no en passa i cau al
 * català, que és el que ja hi sortia.
 */
export function PriceDisplay({
  ep,
  size = "md",
  showPerSession,
  locale,
}: {
  ep: EffectivePrice;
  /** "sm" per a llistats compactes, "md" per a targetes */
  size?: "sm" | "md";
  /** Si > 1 sessió, mostra preu/sessió calculat del preu final */
  showPerSession?: number;
  /** Idioma de qui llegeix. Sense ell, català (com la resta de `lib/labels`). */
  locale?: Locale;
}) {
  const textFinal = size === "sm" ? "text-sm font-bold" : "font-bold";
  const textOrig  = size === "sm" ? "text-xs" : "text-sm";

  if (!ep.hasDiscount) {
    return (
      <span className={`${textFinal} text-brand-purple`}>
        {formatEur(ep.finalPrice, locale)}
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
          {formatEur(ep.finalPrice, locale)}
        </span>
      </span>
      <span className={`${textOrig} text-brand-muted line-through`}>
        {formatEur(ep.originalPrice, locale)}
      </span>
      {showPerSession !== undefined && showPerSession > 1 && (
        <span className="text-xs text-brand-muted">
          {formatEur(ep.finalPrice / showPerSession, locale)}/sessió
        </span>
      )}
    </span>
  );
}
