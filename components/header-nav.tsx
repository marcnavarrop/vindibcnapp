"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/utils";

type NavItem = { href: string; label: string; exact?: boolean };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Inici", exact: true },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/bonos", label: "Bons" },
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/pagos", label: "Pagaments" },
];

/**
 * Barra de navegación de sección. Por ahora solo el área de administración
 * tiene subsecciones; en trainer/client no se muestra nada.
 */
export function HeaderNav() {
  const pathname = usePathname();
  if (!pathname.startsWith("/admin")) return null;

  return (
    <nav className="mx-auto max-w-5xl px-6">
      <ul className="flex gap-1 overflow-x-auto">
        {ADMIN_NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "inline-block border-b-2 px-3 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
                  active
                    ? "border-brand-purple text-brand-purple"
                    : "border-transparent text-brand-muted hover:text-brand-dark",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
