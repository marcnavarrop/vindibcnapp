"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupOf, type NavItem, type Role } from "@/lib/nav";
import { SectionTabsFrame, sectionTabClass, TabLabel } from "@/components/ui/section-tabs";

/**
 * Les pestanyes d'un grup del menú (Bons i pagaments, Reserves…), a dalt del
 * contingut de cada pàgina del grup. Va DINS del `<main>`, abans del títol,
 * perquè quedi a la mateixa columna que ell sigui quina sigui l'amplada de la
 * pàgina.
 *
 * El nom del grup i el nom curt de cada pestanya surten del menú (`lib/nav`):
 * el que diu la pantalla és el que diu el menú.
 */
export function GroupTabs({
  tabs,
  className,
}: {
  tabs: NavItem[];
  /** Les agendes, amb menys aire a sota: el calendari ha de començar amunt. */
  className?: string;
}) {
  const pathname = usePathname();
  const role: Role = pathname.startsWith("/trainer") ? "trainer" : "admin";
  const group = tabs[0] ? groupOf(role, tabs[0].href) : null;
  const shortOf = (href: string) => group?.children.find((c) => c.href === href)?.shortLabel;

  return (
    <SectionTabsFrame label="Pestanyes de secció" group={group?.label} className={className}>
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={sectionTabClass(active)}
          >
            <TabLabel label={tab.label} short={shortOf(tab.href)} />
          </Link>
        );
      })}
    </SectionTabsFrame>
  );
}
