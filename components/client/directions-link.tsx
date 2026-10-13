"use client";

import { useTranslations } from "next-intl";
import { useCenterContact } from "@/components/center-contact-line";
import { Icon } from "@/components/ui/home-icon";
import { TAP } from "@/lib/utils";

/**
 * «Com arribar»: l'adreça del centre (Configuració) oberta al mapa.
 *
 * L'adreça arriba pel context del contacte públic, sense cap consulta més. Si
 * el centre no l'ha omplerta, no es pinta res.
 */
export function DirectionsLink({ className = "" }: { className?: string }) {
  const t = useTranslations("home.next");
  const address = useCenterContact()?.address;
  if (!address) return null;
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-bold text-brand-purple hover:text-brand-purple-dark hover:underline ${TAP} ${className}`}
    >
      <Icon name="pin" size={15} />
      {t("directions")}
    </a>
  );
}
