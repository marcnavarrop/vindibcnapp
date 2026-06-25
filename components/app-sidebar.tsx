"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";
import { SignOutButton } from "@/components/sign-out-button";
import { USE_MOCK } from "@/lib/config";
import { SPECIALTY_LABELS } from "@/lib/labels";
import { NAV, AREA_LABELS, HOME_PATH, type Role } from "@/lib/nav";
import type { Specialty } from "@/types/database";

/** Subtítulo bajo el logo: la especialidad para fisios, si no la etiqueta del área. */
function areaSubtitle(role: Role, specialty: Specialty | null): string {
  if (role === "trainer" && specialty) return SPECIALTY_LABELS[specialty];
  return AREA_LABELS[role];
}

/** Inicial para el avatar: del nombre completo o, si falta, del correo. */
function initialOf(fullName: string, email: string): string {
  const src = (fullName || email).trim();
  return src ? src[0].toUpperCase() : "?";
}

function Avatar({ initial }: { initial: string }) {
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-bold text-white"
    >
      {initial}
    </div>
  );
}

/**
 * Navegación lateral común a las tres áreas (admin/trainer/client),
 * parametrizada por rol.
 *
 * - Escritorio (lg+): sidebar fijo a la izquierda.
 * - Móvil: barra superior con menú hamburguesa que abre un panel deslizante.
 */
export function AppSidebar({
  role,
  specialty = null,
  fullName = "",
  email = "",
}: {
  role: Role;
  specialty?: Specialty | null;
  fullName?: string;
  email?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initial = initialOf(fullName, email);

  // Cierra el panel al navegar.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Sidebar fijo (escritorio) ── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col bg-brand-purple text-white">
        <SidebarContent
          role={role}
          specialty={specialty}
          initial={initial}
          pathname={pathname}
        />
      </aside>

      {/* ── Barra superior (móvil) ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-brand-purple px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Obrir menú"
            className="rounded-md p-1.5 hover:bg-white/10"
          >
            <MenuIcon />
          </button>
          <Link href={HOME_PATH[role]}>
            <Wordmark className="text-xl text-white" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Avatar initial={initial} />
          <SignOutButton />
        </div>
      </header>

      {/* ── Panel deslizante (móvil) ── */}
      {open && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col bg-brand-purple text-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tancar menú"
              className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-white/10"
            >
              <CloseIcon />
            </button>
            <SidebarContent
          role={role}
          specialty={specialty}
          initial={initial}
          pathname={pathname}
        />
          </div>
        </div>
      )}
    </>
  );
}

function SidebarContent({
  role,
  specialty,
  initial,
  pathname,
}: {
  role: Role;
  specialty: Specialty | null;
  initial: string;
  pathname: string;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link href={HOME_PATH[role]} className="px-2 pt-2">
        <Wordmark className="text-2xl text-white" />
        <span className="mt-0.5 block text-xs font-bold tracking-widest text-white/60 uppercase">
          {areaSubtitle(role, specialty)}
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {NAV[role].map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center rounded-lg border-l-4 px-3 py-2.5 text-sm font-bold transition-colors",
                    active
                      ? "border-brand-orange bg-white/15 text-white"
                      : "border-transparent text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
        {USE_MOCK && (
          <span className="rounded-full bg-brand-orange/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-orange uppercase">
            Demo
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Avatar initial={initial} />
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
