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
 * URL pública (HTTPS) del logo per a la capçalera dels emails: el mateix
 * fitxer que fa servir tota l'app (`public/images/logo-vindi.png`), servit pel
 * domini de l'app. Es pot sobreescriure amb `EMAIL_LOGO_URL` (p. ex. un CDN).
 *
 * Ha de ser una URL absoluta i pública: un correu s'obre fora de l'app i cap
 * client de correu pot resoldre una ruta relativa del projecte.
 *
 * És un PNG amb transparència a propòsit, no un WebP: el canal alfa el
 * suporten tots els clients de correu i deixa que el logo caigui damunt del
 * lila de la capçalera sense cap caixa al voltant, mentre que el WebP encara
 * no es veu a Outlook d'escriptori.
 */
export function emailLogoUrl(): string {
  return process.env.EMAIL_LOGO_URL || appLink("/images/logo-vindi.png");
}

/**
 * Mida del logo a la capçalera del correu, en píxels.
 *
 * Van als atributs `width`/`height` de l'`<img>` i no només a l'estil: Outlook
 * ignora part del CSS i, sense els atributs, reserva la mida original del
 * fitxer i ensenya el logo gegant. La proporció és la del fitxer (299×120).
 */
export const EMAIL_LOGO_SIZE = { width: 100, height: 40 } as const;
