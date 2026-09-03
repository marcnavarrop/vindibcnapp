"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  House,
  Ticket,
  CalendarDays,
  Dumbbell,
  FileText,
  Users,
  User,
  Settings,
  Contact,
  Package,
  Receipt,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { clsx, TAP } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Wordmark } from "@/components/wordmark";
import { SignOutButton } from "@/components/sign-out-button";
import { USE_MOCK } from "@/lib/config";
import { SPECIALTY_LABELS } from "@/lib/labels";
import {
  NAV_GROUPS,
  isNavGroup,
  AREA_LABELS,
  HOME_PATH,
  filterNavByModules,
  ALL_MODULES_ON,
  CLIENT_PROFILE_PATH,
  type Role,
  type ModuleFlags,
  type NavIcon,
} from "@/lib/nav";
import type { Specialty } from "@/types/database";

/** Del nom que hi ha a la configuració del menú a la icona de debò. */
const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  ticket: Ticket,
  calendar: CalendarDays,
  dumbbell: Dumbbell,
  document: FileText,
  community: Users,
  profile: User,
  settings: Settings,
  people: Contact,
  catalog: Package,
  billing: Receipt,
};

/** Subtítulo bajo el logo: la especialidad para fisios, si no la etiqueta del área. */
function areaSubtitle(role: Role, specialty: Specialty | null): string {
  if (role === "trainer" && specialty) return SPECIALTY_LABELS[specialty];
  return AREA_LABELS[role];
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
  avatarUrl = null,
  modules = ALL_MODULES_ON,
}: {
  role: Role;
  specialty?: Specialty | null;
  fullName?: string;
  email?: string;
  /** Signed URL de la foto de perfil. Si falta, es pinta la inicial. */
  avatarUrl?: string | null;
  /** Mòduls actius; els desactivats no surten al menú. */
  modules?: ModuleFlags;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
          pathname={pathname}
          modules={modules}
        />
      </aside>

      {/* ── Barra superior (móvil) ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-brand-purple px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-3">
          {/* L'etiqueta la sent un lector de pantalla: ha d'anar en l'idioma
              de qui llegeix. Va en un component a part perquè `aria-label`
              necessita una cadena i el hook de traducció no es pot cridar
              condicionalment. */}
          {role === "client" ? (
            <TranslatedMenuButton onClick={() => setOpen(true)} />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Obrir menú"
              className="rounded-md p-1.5 transition-[background-color,transform] duration-100 hover:bg-white/10 active:scale-90 active:bg-white/20 [-webkit-tap-highlight-color:transparent] touch-manipulation"
            >
              <MenuIcon />
            </button>
          )}
          <Link href={HOME_PATH[role]}>
            <Wordmark height={26} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Avatar name={fullName} email={email} url={avatarUrl} />
          {role === "client" ? <TranslatedSignOut compact /> : <SignOutButton />}
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
            {role === "client" ? (
              <TranslatedCloseButton onClick={() => setOpen(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tancar menú"
                className="absolute top-3 right-3 rounded-md p-1.5 transition-[background-color,transform] duration-100 hover:bg-white/10 active:scale-90 active:bg-white/20 [-webkit-tap-highlight-color:transparent] touch-manipulation"
              >
                <CloseIcon />
              </button>
            )}
            <SidebarContent
          role={role}
          specialty={specialty}
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
          pathname={pathname}
          modules={modules}
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
  fullName,
  email,
  avatarUrl,
  pathname,
  modules,
}: {
  role: Role;
  specialty: Specialty | null;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  /** Només l'àrea de client té diccionari: la resta es queda en català. */
  translated?: boolean;
  pathname: string;
  modules: ModuleFlags;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link href={HOME_PATH[role]} className="px-2 pt-2">
        <Wordmark height={30} />
        <span className="mt-1.5 block text-xs font-bold tracking-widest text-white/60 uppercase">
          {areaSubtitle(role, specialty)}
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {filterNavByModules(NAV_GROUPS[role], modules).map((entry) => {
            if (isNavGroup(entry)) {
              const active = entry.children.some(
                (c) =>
                  pathname === c.href || pathname.startsWith(`${c.href}/`),
              );
              return (
                <li key={entry.label}>
                  <NavLink
                    href={entry.children[0].href}
                    label={entry.label}
                    icon={entry.icon}
                    active={active}
                  />
                </li>
              );
            }
            // Una drecera (p. ex. "Perfil") comparteix ruta amb l'entrada de
            // debò: no s'il·lumina mai, o hi hauria dos elements actius alhora.
            const active =
              !entry.shortcut &&
              (entry.exact
                ? pathname === entry.href
                : pathname === entry.href ||
                  pathname.startsWith(`${entry.href}/`));
            return (
              <li key={entry.label}>
                <NavLink
                  href={entry.href}
                  /* Amb clau, el text surt del diccionari; sense, es queda el
                     català. Així l'admin i el professional no s'assabenten. */
                  label={
                    entry.labelKey ? (
                      <NavLabel k={entry.labelKey} />
                    ) : (
                      entry.label
                    )
                  }
                  icon={entry.icon}
                  active={active}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      <SidebarFooter
        fullName={fullName}
        email={email}
        avatarUrl={avatarUrl}
        // Només el client té on anar: el seu perfil és la primera pestanya de
        // Configuració. Admin i professional no tenen cap pàgina de perfil, i
        // un enllaç que no porta enlloc és pitjor que cap enllaç.
        profileHref={role === "client" ? CLIENT_PROFILE_PATH : null}
        translated={role === "client"}
      />

      <div className="flex flex-wrap gap-x-2 gap-y-1 px-1 text-[10px] text-white/40">
        <Link href="/legal/privacitat" className="hover:text-white/70">
          {role === "client" ? <LegalLabel k="privacy" /> : "Privacitat"}
        </Link>
        <span>·</span>
        <Link href="/legal/avis-legal" className="hover:text-white/70">
          {role === "client" ? <LegalLabel k="notice" /> : "Avís legal"}
        </Link>
        <span>·</span>
        <Link href="/legal/cookies" className="hover:text-white/70">
          {role === "client" ? <LegalLabel k="cookies" /> : "Cookies"}
        </Link>
      </div>
    </div>
  );
}

/**
 * Una entrada del menú. La icona és opcional: les àrees d'admin i professional
 * encara no en tenen i han de seguir veient-se igual que abans.
 */
function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: React.ReactNode;
  icon?: NavIcon;
  active: boolean;
}) {
  const Icon = icon ? NAV_ICONS[icon] : null;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm font-bold",
        // Sobre el lila del menú els tons `brand-*-dark` no es veurien: aquí
        // el llenguatge és la veladura blanca, que és la que ja fa servir el
        // `hover`. La entrada activa parteix d'un blanc més alt, així que en
        // prémer-la puja més per notar-se igual.
        TAP,
        active
          ? "border-brand-orange bg-white/15 text-white active:bg-white/25"
          : "border-transparent text-white/80 hover:bg-white/10 hover:text-white active:bg-white/20",
      )}
    >
      {Icon && (
        <Icon
          size={19}
          strokeWidth={1.9}
          aria-hidden
          className={clsx("shrink-0", !active && "text-white/70")}
        />
      )}
      {label}
    </Link>
  );
}

/**
 * Peu del menú: qui ha entrat i com sortir.
 *
 * Amb `profileHref` el bloc sencer és l'enllaç —nom, subtítol i fletxa—
 * perquè la zona on es pot clicar sigui la que es veu; sense, és només la
 * fitxa de qui hi ha dins. La fletxa apunta a la dreta i no cap avall a
 * propòsit: aquí no s'obre cap menú, es va a una altra pantalla.
 */
function SidebarFooter({
  fullName,
  email,
  avatarUrl,
  profileHref,
  translated,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  profileHref: string | null;
  /** Només l'àrea de client té diccionari: la resta es queda en català. */
  translated?: boolean;
}) {
  const identity = (
    <>
      <Avatar name={fullName} email={email} url={avatarUrl} size={38} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-white">
            {fullName || "El meu compte"}
          </span>
          {USE_MOCK && (
            <span className="shrink-0 rounded-full bg-brand-orange/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-orange uppercase">
              Demo
            </span>
          )}
        </span>
        {/*
          Diu on va, no què hi ha.

          Abans deia "Veure el meu perfil" perquè al menú hi havia una entrada
          "Perfil" que apuntava al mateix lloc. Tretes les dues entrades
          bessones, prometia una pàgina que no existeix: les dades personals
          són la primera pestanya de Configuració. Tocar el teu nom per anar-hi
          és un gest que val la pena conservar —sobretot en mòbil—, però
          l'etiqueta ha de dir la veritat.
        */}
        {profileHref && (
          <span className="block truncate text-xs text-white/60">
            {translated ? <NavLabel k="configuracio" /> : "Configuració"}
          </span>
        )}
      </span>
      {profileHref && (
        <ChevronRight size={18} aria-hidden className="shrink-0 text-white/50" />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 px-1 pt-4">
      {profileHref ? (
        <Link
          href={profileHref}
          className={clsx(
            "flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-white/10 active:bg-white/20",
            TAP,
          )}
        >
          {identity}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-1 py-1.5">{identity}</div>
      )}

      {translated ? (
        <TranslatedSignOut />
      ) : (
        <SignOutButton variant="panel" />
      )}
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

/**
 * El text d'una entrada del menú, tret del diccionari.
 *
 * Viu en un component propi i NO dins de `NavLink` a posta: `useTranslations`
 * necessita el proveïdor, que només embolcalla l'àrea de client. Com que
 * aquest component només es renderitza per a les entrades que porten clau
 * —totes del client—, l'admin i el professional no arriben a muntar-lo.
 */
function NavLabel({ k }: { k: string }) {
  const t = useTranslations("nav");
  return <>{t(k)}</>;
}

/** Els enllaços legals del peu, per a l'àrea de client. */
function LegalLabel({ k }: { k: string }) {
  const t = useTranslations("legal");
  return <>{t(k)}</>;
}

/**
 * El botó de tancar sessió del client, amb el text del diccionari.
 *
 * `compact` és el de la barra superior de mòbil, que no porta la caixa del
 * panell. Va pel mateix camí a propòsit: si no, un dels dos torna a quedar-se
 * en català sense que ningú se n'adoni —que és exactament el que va passar.
 */
function TranslatedSignOut({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("nav");
  return (
    <SignOutButton
      variant={compact ? "compact" : "panel"}
      label={t("signOut")}
    />
  );
}

/** El botó de tancar el panell lliscant, amb l'etiqueta traduïda. */
function TranslatedCloseButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("closeMenu")}
      className="absolute top-3 right-3 rounded-md p-1.5 transition-[background-color,transform] duration-100 hover:bg-white/10 active:scale-90 active:bg-white/20 [-webkit-tap-highlight-color:transparent] touch-manipulation"
    >
      <CloseIcon />
    </button>
  );
}

/** El botó del menú de mòbil amb l'etiqueta traduïda (àrea de client). */
function TranslatedMenuButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("openMenu")}
      className="rounded-md p-1.5 transition-[background-color,transform] duration-100 hover:bg-white/10 active:scale-90 active:bg-white/20 [-webkit-tap-highlight-color:transparent] touch-manipulation"
    >
      <MenuIcon />
    </button>
  );
}
