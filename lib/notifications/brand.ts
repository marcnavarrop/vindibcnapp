/**
 * Colors i constants de marca per als emails. Copiats EXACTAMENT dels tokens de
 * `app/globals.css` (`--color-brand-*`). En email cal hex literals inline: els
 * clients de correu no suporten variables CSS ni classes de Tailwind. Un únic
 * lloc perquè totes les plantilles els comparteixin.
 */
export const BRAND = {
  purple: "#642263", // --color-brand-purple (lila del sidebar)
  purpleLight: "#965495", // --color-brand-purple-light
  orange: "#ff6d17", // --color-brand-orange (accent)
  dark: "#1b1d1f", // --color-brand-dark
  charcoal: "#303133", // --color-brand-charcoal (text principal)
  muted: "#777777", // --color-brand-muted
  border: "#eaeaea", // --color-brand-border
  bg: "#f7f7f7", // --color-brand-bg
  white: "#ffffff",
} as const;

/** Nom del centre (per capçalera i peu). */
export const CENTER_NAME = "VindiBCN";

/**
 * URL base de l'app per als enllaços dels emails. Configurable per entorn; a
 * Vercel es fa servir el domini de producció automàticament.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Construeix una URL absoluta cap a una ruta de l'app. */
export function appLink(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * URL pública (HTTPS) del logo per a la capçalera dels emails. Per defecte, el
 * fitxer del repo `public/logo_vindi.png` servit pel domini de l'app (a Vercel,
 * el domini de producció automàticament). Es pot sobreescriure amb `EMAIL_LOGO_URL`
 * (p. ex. un CDN). Sempre s'acompanya del text "VindiBCN", així que si un client
 * bloqueja la imatge la marca segueix llegint-se.
 */
export function emailLogoUrl(): string {
  return process.env.EMAIL_LOGO_URL || appLink("/logo_vindi.png");
}
