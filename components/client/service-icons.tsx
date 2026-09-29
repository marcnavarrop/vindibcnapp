import type { ServiceType } from "@/types/database";

/** Icones de servei (SVG inline, ~10 px). Les fan servir la llista de Reserves i la capçalera. */
export const SVC_ICON: Record<ServiceType, React.ReactNode> = {
  ep_individual: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="2" />
      <path d="M1 10c0-3.5 8-3.5 8 0z" />
    </svg>
  ),
  ep_parejas: (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3.5" r="2" /><path d="M0 10c0-3.5 8-3.5 8 0z" />
      <circle cx="9" cy="3.5" r="2" /><path d="M5 10c0-3.5 8-3.5 8 0z" />
    </svg>
  ),
  grupo_reducido: (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="3" r="1.7" /><path d="M0 9.5c0-3 5-3 5 0z" />
      <circle cx="8" cy="3" r="1.7" /><path d="M5 9.5c0-3 6-3 6 0z" />
      <circle cx="13.5" cy="3" r="1.7" /><path d="M11 9.5c0-3 5-3 5 0z" />
    </svg>
  ),
  fisioterapia: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <rect x="0" y="2.5" width="1.5" height="4.5" rx="0.75" />
      <rect x="2" y="0.5" width="1.5" height="6" rx="0.75" />
      <rect x="4" y="0" width="1.5" height="6.5" rx="0.75" />
      <rect x="6" y="0.5" width="1.5" height="6" rx="0.75" />
      <rect x="8" y="2" width="1.5" height="5" rx="0.75" />
      <rect x="0" y="6" width="10" height="4" rx="1.5" />
    </svg>
  ),
};
