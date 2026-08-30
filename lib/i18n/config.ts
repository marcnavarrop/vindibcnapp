/**
 * Idiomes de l'àrea de client i de les pàgines públiques.
 *
 * Admin i professional NO hi entren: es queden en català fix. Traduir el
 * panell intern no és el mateix problema —qui hi treballa és del centre— i
 * mantenir-lo en tres idiomes costaria a cada canvi sense que ningú ho demani.
 */
export const LOCALES = ["ca", "es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Català. És el que ja parla l'app, i el que queda si falta una traducció. */
export const DEFAULT_LOCALE: Locale = "ca";

/** Nom de la cookie amb l'idioma triat. */
export const LOCALE_COOKIE = "vindi_locale";

/** Un any: la tria d'idioma no caduca en tancar el navegador. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** El de sempre si el que arriba no és cap dels tres. */
export function toLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Com es diu cada idioma EN el seu idioma: així el troba qui no llegeix els altres. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ca: "Català",
  es: "Castellano",
  en: "English",
};

/**
 * L'etiqueta d'`Intl` per a cada idioma.
 *
 * L'anglès va a `en-GB` i no a `en-US`: el centre és a Barcelona i la resta de
 * l'app dona les hores en format de 24 h i les dates amb el dia al davant. Amb
 * `en-US` una mateixa pantalla barrejaria "30 August" amb "8/30" i les hores
 * passarien a AM/PM només per a qui llegeix en anglès.
 *
 * Viu aquí i no a `labels.ts` perquè també el necessiten els calendaris, que
 * formaten dates amb `Intl` directament.
 */
const INTL_LOCALE: Record<Locale, string> = {
  ca: "ca-ES",
  es: "es-ES",
  en: "en-GB",
};

export function intlLocale(locale: Locale = DEFAULT_LOCALE): string {
  return INTL_LOCALE[locale] ?? INTL_LOCALE[DEFAULT_LOCALE];
}
