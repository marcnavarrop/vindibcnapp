"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

/**
 * Barra de pestanyes horitzontal per a seccions agrupades.
 * Es mostra a la part superior del contingut de cada pàgina del grup.
 */
export function GroupTabs({ tabs }: { tabs: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-brand-border bg-white">
      <nav
        className="mx-auto flex max-w-5xl overflow-x-auto px-6"
        aria-label="Pestanyes de secció"
      >
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors",
                active
                  ? "border-brand-purple text-brand-purple"
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
