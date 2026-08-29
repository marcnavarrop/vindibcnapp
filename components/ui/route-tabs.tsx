"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/utils";

export type RouteTab = {
  href: string;
  label: string;
  /** Quan la pestanya NO és activa, es pinta en color de accent (taronja). */
  accent?: boolean;
};

/**
 * Barra de pestanyes horitzontal basada en rutes.
 * Versió lleugera de GroupTabs amb suport per a una pestanya de conversió
 * ressaltada en taronja quan no és la pestanya activa.
 */
export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
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
    <div className="mb-6 border-b border-brand-border">
      <nav className="flex overflow-x-auto" aria-label="Navegació de secció">
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors",
                active
                  ? "border-brand-purple text-brand-purple"
                  : tab.accent
                    ? "border-transparent text-brand-orange hover:opacity-80"
                    : "border-transparent text-brand-muted hover:text-brand-dark",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
