/**
 * Configuración de navegación por rol. Datos planos (sin JSX) para que los
 * puedan importar tanto componentes de servidor como de cliente.
 */
export type Role = "admin" | "trainer" | "client";

export type NavItem = { href: string; label: string; exact?: boolean };

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

export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Inici", exact: true },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/entrenadors", label: "Entrenadors" },
    { href: "/admin/bonos", label: "Bons" },
    { href: "/admin/reservas", label: "Reserves" },
    { href: "/admin/prova", label: "Sessions de prova" },
    { href: "/admin/disponibilitat", label: "Disponibilitat" },
    { href: "/admin/pagos", label: "Pagaments" },
    { href: "/admin/serveis", label: "Serveis" },
    { href: "/admin/exercicis", label: "Exercicis" },
    { href: "/admin/community", label: "Comunitat" },
    { href: "/admin/configuracio", label: "Configuració" },
  ],
  trainer: [
    { href: "/trainer", label: "Inici", exact: true },
    { href: "/trainer/clients", label: "Clients" },
    { href: "/trainer/reservas", label: "Reserves" },
    { href: "/trainer/disponibilitat", label: "Disponibilitat" },
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
