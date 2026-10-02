"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SectionTabsFrame, sectionTabClass } from "@/components/ui/section-tabs";

export type RouteTab = {
  href: string;
  label: string;
  /** Quan la pestanya NO és activa, es pinta en color de accent (taronja). */
  accent?: boolean;
};

/**
 * Barra de pestanyes horitzontal basada en rutes.
 * Les del client (Bons: Comprar bo nou · Els meus bons), amb la mateixa forma
 * que les de l'equip. La de conversió, en taronja quan no és l'activa (el color
 * es decideix al pas 7).
 */
export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  // Aquest component només surt a l'àrea de client, que va dins del proveïdor
  // d'idioma: aquí sí que es pot cridar el hook directament.
  const t = useTranslations("nav");
  const pathname = usePathname();

  /**
   * Activa NOMÉS la pestanya que casa millor, no totes les que casen.
   *
   * Amb una comprovació per pestanya, "/client/bonos" també és prefix de
   * "/client/bonos/comprar" i les dues s'encenien alhora: dues pestanyes
   * morades i cap manera de saber on ets. Guanya l'href més llarg que casa,
   * que és sempre la pestanya més específica.
   */
  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .reduce<string | null>(
      (best, t) => (best === null || t.href.length > best.length ? t.href : best),
      null,
    );

  return (
    <SectionTabsFrame label={t("sectionTabs")}>
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={sectionTabClass(active, tab.accent)}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </SectionTabsFrame>
  );
}
