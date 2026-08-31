/**
 * Configuración de navegación por rol. Datos planos (sin JSX) para que los
 * puedan importar tanto componentes de servidor como de cliente.
 */
export type Role = "admin" | "trainer" | "client";

/**
 * Icona de cada entrada del menú. És un nom, no el component: aquest fitxer
 * l'importen també Server Components i ha de seguir sent dades planes. El
 * sidebar (que sí que és de client) tradueix el nom a la icona de debò.
 */
export type NavIcon =
  | "home"
  | "ticket"
  | "calendar"
  | "dumbbell"
  | "document"
  | "community"
  | "profile"
  | "settings"
  | "people"
  | "catalog"
  | "billing";

export type NavItem = {
  href: string;
  /** Text en català. És el que veuen l'admin i el professional. */
  label: string;
  /**
   * Clau al diccionari (`nav.*`) per a les entrades de l'àrea de CLIENT, que
   * és l'única traduïda. Sense clau, es pinta el `label`.
   */
  labelKey?: string;
  exact?: boolean;
  icon?: NavIcon;
  /**
   * Drecera cap a un tros d'una altra pàgina. No s'il·lumina mai encara que la
   * ruta coincideixi: qui mana sobre l'estat actiu és l'entrada de la pàgina.
   *
   * Ara mateix no la fa servir ningú —l'única que hi havia era "Perfil", al
   * menú del client, que apuntava a Configuració i s'ha tret—. Es manté perquè
   * el sidebar ja la sap tractar i el dia que torni a caldre una drecera no
   * s'ha de tornar a pensar.
   */
  shortcut?: boolean;
};

/** Grup de seccions relacionades que apareix com una sola entrada al sidebar. */
export type NavGroup = { label: string; children: NavItem[]; icon?: NavIcon };

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

export const AREA_LABELS: Record<Role, string> = {
  admin: "Administració",
  trainer: "Professional",
  client: "Àrea client",
};

export const HOME_PATH: Record<Role, string> = {
  admin: "/admin",
  trainer: "/trainer",
  client: "/client",
};

/**
 * On porta el bloc del compte, al peu del sidebar.
 *
 * No hi ha cap pàgina `/client/perfil`: les dades personals són la primera
 * pestanya de Configuració. Hi havia també una entrada "Perfil" al menú que hi
 * apuntava, i s'ha tret —dues entrades del menú a la mateixa pàgina obliguen a
 * endevinar en què es diferencien—. Queda la constant perquè el peu del
 * sidebar hi segueix anant.
 */
export const CLIENT_PROFILE_PATH = "/client/configuracio";

/**
 * Estructura de navegació amb grups. Substitueix NAV al sidebar.
 * Els grups amb múltiples fills es mostren com una sola entrada al sidebar
 * i com pestanyes dins de cada pàgina del grup.
 */
export const NAV_GROUPS: Record<Role, NavEntry[]> = {
  // Un concepte que es repeteix a dues àrees porta la mateixa icona: les
  // reserves són el calendari als tres rols, els bons el tiquet, i la
  // configuració l'engranatge. Qui faci servir dues àrees no ha de reaprendre
  // el menú.
  admin: [
    { href: "/admin", label: "Inici", exact: true, icon: "home" },
    {
      label: "Persones",
      icon: "people",
      children: [
        { href: "/admin/clients", label: "Clients" },
        { href: "/admin/entrenadors", label: "Professionals" },
      ],
    },
    {
      label: "Reserves",
      icon: "calendar",
      children: [
        { href: "/admin/reservas", label: "Reserves" },
        { href: "/admin/disponibilitat", label: "Disponibilitat" },
        { href: "/admin/prova", label: "Sessions de prova" },
      ],
    },
    {
      label: "Bons i pagaments",
      icon: "ticket",
      children: [
        { href: "/admin/bonos", label: "Bons" },
        { href: "/admin/pagos", label: "Pagaments" },
        { href: "/admin/vals-regal", label: "Vals de regal" },
        { href: "/admin/referits", label: "Referits" },
      ],
    },
    {
      label: "Catàleg",
      icon: "catalog",
      children: [
        { href: "/admin/serveis", label: "Serveis" },
        { href: "/admin/ofertes", label: "Ofertes" },
      ],
    },
    {
      label: "Facturació",
      icon: "billing",
      children: [
        { href: "/admin/facturacio/tarifes", label: "Tarifes" },
        { href: "/admin/facturacio/liquidacions", label: "Liquidacions" },
        { href: "/admin/facturacio/bonus", label: "Bonus" },
      ],
    },
    { href: "/admin/exercicis", label: "Exercicis", icon: "dumbbell" },
    { href: "/admin/community", label: "Comunitat", icon: "community" },
    { href: "/admin/configuracio", label: "Configuració", icon: "settings" },
  ],
  trainer: [
    { href: "/trainer", label: "Inici", exact: true, icon: "home" },
    { href: "/trainer/clients", label: "Clients", icon: "people" },
    {
      label: "Reserves",
      icon: "calendar",
      children: [
        { href: "/trainer/reservas", label: "Reserves" },
        { href: "/trainer/disponibilitat", label: "Disponibilitat" },
      ],
    },
    { href: "/trainer/bonos", label: "Bons", icon: "ticket" },
    {
      href: "/trainer/factures",
      label: "Les meves factures",
      icon: "billing",
    },
    { href: "/trainer/exercicis", label: "Exercicis", icon: "dumbbell" },
    { href: "/trainer/comunitat", label: "Comunitat", icon: "community" },
    { href: "/trainer/configuracio", label: "Configuració", icon: "settings" },
  ],
  // El client és l'única àrea amb icones de moment: el seu menú es va
  // redissenyar abans que el d'admin i professional, que segueixen amb la
  // llista de text de sempre fins que els toqui.
  // El `labelKey` només el porten les entrades del CLIENT: és l'única àrea
  // traduïda. El `label` es queda com a text en català —el fan servir la clau
  // de React i qualsevol lectura que no passi pel diccionari— i és el que es
  // veurà si algun dia falta la traducció.
  client: [
    { href: "/client", label: "Inici", labelKey: "home", exact: true, icon: "home" },
    { href: "/client/bonos", label: "Bons", labelKey: "bonos", icon: "ticket" },
    { href: "/client/reservas", label: "Reserves", labelKey: "reservas", icon: "calendar" },
    { href: "/client/exercicis", label: "Exercicis", labelKey: "exercicis", icon: "dumbbell" },
    { href: "/client/documents", label: "Documents", labelKey: "documents", icon: "document" },
    { href: "/client/comunitat", label: "Comunitat", labelKey: "comunitat", icon: "community" },
    { href: "/client/configuracio", label: "Configuració", labelKey: "configuracio", icon: "settings" },
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
