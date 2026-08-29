import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/resolve";

/**
 * D'on surt l'idioma de cada petició.
 *
 * next-intl es fa servir en mode "sense enrutament d'idioma": no hi ha cap
 * segment [locale] a l'URL i l'arbre de rutes es queda tal com estava. Es va
 * triar així a posta: el middleware ja porta el control d'accés dels tres rols
 * i el `redirectedFrom`, i moure totes les rutes sota un segment nou per
 * guanyar `/es/...` hauria posat en risc el que ja funciona a canvi de res que
 * ningú hagi demanat.
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
