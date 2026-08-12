/**
 * Pestanyes compartides dels grups de l'àrea d'administració.
 *
 * Viuen aquí perquè cada pàgina d'un grup n'ha de pintar la llista SENCERA. Amb
 * la llista copiada a cada fitxer, afegir-hi una pestanya volia dir tocar-les
 * totes i, si te'n deixaves una, aquella pantalla ensenyava un grup incomplet
 * —que és exactament el que passava amb Referits, que no en tenia cap.
 *
 * Dades planes, sense JSX: les importen Server Components.
 */
export const BONS_TABS = [
  { href: "/admin/bonos", label: "Bons" },
  { href: "/admin/pagos", label: "Pagaments" },
  { href: "/admin/vals-regal", label: "Vals de regal" },
  { href: "/admin/referits", label: "Referits" },
];
