"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/utils";

type NavItem = { href: string; label: string; exact?: boolean };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Inici", exact: true },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/entrenadors", label: "Entrenadors" },
  { href: "/admin/bonos", label: "Bons" },
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/pagos", label: "Pagaments" },
  { href: "/admin/serveis", label: "Serveis" },
  { href: "/admin/exercicis", label: "Exercicis" },
  { href: "/admin/community", label: "Comunitat" },
];

const TRAINER_NAV: NavItem[] = [
  { href: "/trainer", label: "Inici", exact: true },
  { href: "/trainer/clients", label: "Clients" },
  { href: "/trainer/reservas", label: "Reserves" },
  { href: "/trainer/bonos", label: "Bons" },
  { href: "/trainer/exercicis", label: "Exercicis" },
];

/**
 * Barra de navegación de sección para las áreas de admin y de entrenador/a.
 * En el área de cliente no se muestra nada.
 */
export function HeaderNav() {
  const pathname = usePathname();
  const items = pathname.startsWith("/admin")
    ? ADMIN_NAV
    : pathname.startsWith("/trainer")
      ? TRAINER_NAV
      : null;
  if (!items) return null;

  return (
    <nav className="mx-auto max-w-5xl px-6">
      <ul className="flex gap-1 overflow-x-auto">
        {items.map((item) => {
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
