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
  trainer: "Entrenador/a",
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
        { href: "/admin/entrenadors", label: "Entrenadors" },
      ],
    },
    {
      label: "Reserves",
      children: [
        { href: "/admin/reservas", label: "Reserves" },
        { href: "/admin/prova", label: "Sessions de prova" },
        { href: "/admin/disponibilitat", label: "Disponibilitat" },
      ],
    },
    {
      label: "Bons i pagaments",
      children: [
        { href: "/admin/bonos", label: "Bons" },
        { href: "/admin/pagos", label: "Pagaments" },
      ],
    },
    {
      label: "Catàleg",
      children: [
        { href: "/admin/serveis", label: "Serveis" },
        { href: "/admin/ofertes", label: "Ofertes" },
      ],
    },
    { href: "/admin/exercicis", label: "Exercicis" },
    { href: "/admin/community", label: "Comunitat" },
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
    { href: "/trainer/exercicis", label: "Exercicis" },
    { href: "/trainer/comunitat", label: "Comunitat" },
    { href: "/trainer/configuracio", label: "Configuració" },
  ],
  client: [
    { href: "/client", label: "Inici", exact: true },
    { href: "/client/bonos", label: "Bonos" },
    { href: "/client/reservas", label: "Reserves" },
    { href: "/client/exercicis", label: "Exercicis" },
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
