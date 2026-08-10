/**
 * Configuración de navegación por rol. Datos planos (sin JSX) para que los
 * puedan importar tanto componentes de servidor como de cliente.
 */
export type Role = "admin" | "trainer" | "client";

export type NavItem = { href: string; label: string; exact?: boolean };

/** Grup de seccions relacionades que apareix com una sola entrada al sidebar. */
export type NavGroup = { label: string; children: NavItem[] };

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

export const AREA_LABELS: Record<Role, string> = {
  admin: "Administració",
  trainer: "Professional",
  client: "La meva àrea",
};

export const HOME_PATH: Record<Role, string> = {
  admin: "/admin",
  trainer: "/trainer",
  client: "/client",
};

/**
 * Estructura de navegació amb grups. Substitueix NAV al sidebar.
 * Els grups amb múltiples fills es mostren com una sola entrada al sidebar
 * i com pestanyes dins de cada pàgina del grup.
 */
export const NAV_GROUPS: Record<Role, NavEntry[]> = {
  admin: [
    { href: "/admin", label: "Inici", exact: true },
    {
      label: "Persones",
      children: [
        { href: "/admin/clients", label: "Clients" },
        { href: "/admin/entrenadors", label: "Professionals" },
      ],
    },
    {
      label: "Reserves",
      children: [
        { href: "/admin/reservas", label: "Reserves" },
        { href: "/admin/disponibilitat", label: "Disponibilitat" },
        { href: "/admin/prova", label: "Sessions de prova" },
      ],
    },
    {
      label: "Bons i pagaments",
      children: [
        { href: "/admin/bonos", label: "Bons" },
        { href: "/admin/pagos", label: "Pagaments" },
        { href: "/admin/referits", label: "Referits" },
      ],
    },
    {
      label: "Catàleg",
      children: [
        { href: "/admin/serveis", label: "Serveis" },
        { href: "/admin/ofertes", label: "Ofertes" },
      ],
    },
    {
      label: "Facturació",
      children: [
        { href: "/admin/facturacio/tarifes", label: "Tarifes" },
        { href: "/admin/facturacio/liquidacions", label: "Liquidacions" },
        { href: "/admin/facturacio/bonus", label: "Bonus" },
      ],
    },
    { href: "/admin/exercicis", label: "Exercicis" },
    { href: "/admin/community", label: "Comunitat" },
    { href: "/admin/suport", label: "Suport" },
    { href: "/admin/configuracio", label: "Configuració" },
  ],
  trainer: [
    { href: "/trainer", label: "Inici", exact: true },
    { href: "/trainer/clients", label: "Clients" },
    {
      label: "Reserves",
      children: [
        { href: "/trainer/reservas", label: "Reserves" },
        { href: "/trainer/disponibilitat", label: "Disponibilitat" },
      ],
    },
    { href: "/trainer/bonos", label: "Bons" },
    { href: "/trainer/factures", label: "Les meves factures" },
    { href: "/trainer/exercicis", label: "Exercicis" },
    { href: "/trainer/comunitat", label: "Comunitat" },
    { href: "/trainer/suport", label: "Suport" },
    { href: "/trainer/configuracio", label: "Configuració" },
  ],
  client: [
    { href: "/client", label: "Inici", exact: true },
    { href: "/client/bonos", label: "Bonos" },
    { href: "/client/reservas", label: "Reserves" },
    { href: "/client/exercicis", label: "Exercicis" },
    { href: "/client/documents", label: "Documents" },
    { href: "/client/comunitat", label: "Comunitat" },
    { href: "/client/configuracio", label: "Configuració" },
  ],
};

/** Retorna les pestanyes del grup al qual pertany el pathname donat, o null. */
export function getGroupTabs(role: Role, pathname: string): NavItem[] | null {
  for (const entry of NAV_GROUPS[role]) {
    if (
      isNavGroup(entry) &&
      entry.children.some(
        (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
      )
    ) {
      return entry.children;
    }
  }
  return null;
}

// ─────────────────────── Mòduls opcionals ───────────────────────

/** Mòduls que l'admin pot desactivar des de Configuració → Centre. */
export type ModuleFlags = {
  comunitat: boolean;
  sessionsProva: boolean;
  documents: boolean;
};

export const ALL_MODULES_ON: ModuleFlags = {
  comunitat: true,
  sessionsProva: true,
  documents: true,
};

/**
 * Prefixos de ruta que pertanyen a cada mòdul. És la font única: la fan servir
 * tant el filtre del menú com la protecció de les pàgines, de manera que no
 * poden divergir.
 */
export const MODULE_PATHS: Record<keyof ModuleFlags, string[]> = {
  comunitat: ["/admin/community", "/trainer/comunitat", "/client/comunitat"],
  sessionsProva: ["/admin/prova", "/prova"],
  documents: ["/client/documents"],
};

/** A quin mòdul pertany una ruta, si és que pertany a cap. */
export function moduleOfPath(pathname: string): keyof ModuleFlags | null {
  for (const [mod, prefixes] of Object.entries(MODULE_PATHS) as [
    keyof ModuleFlags,
    string[],
  ][]) {
    if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
      return mod;
  }
  return null;
}

/** Treu del menú les entrades dels mòduls desactivats. */
export function filterNavByModules(
  entries: NavEntry[],
  modules: ModuleFlags,
): NavEntry[] {
  const visible = (href: string) => {
    const mod = moduleOfPath(href);
    return mod === null || modules[mod];
  };
  return entries
    .map((e) => {
      if (!isNavGroup(e)) return visible(e.href) ? e : null;
      const children = e.children.filter((c) => visible(c.href));
      // Un grup que es queda sense fills desapareix.
      return children.length > 0 ? { ...e, children } : null;
    })
    .filter((e): e is NavEntry => e !== null);
}
