import { createTranslator } from "next-intl";
import ca from "@/messages/ca.json";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/config";

/**
 * L'idioma dels correus.
 *
 * Les pantalles el treuen del context de la petició (`getTranslations`), però
 * un correu no es renderitza dins de cap petició: el dispara un cron, o una
 * Server Action que ja ha acabat de pintar. `createTranslator` de next-intl és
 * una funció pura —li dónes locale i missatges i et torna el traductor— i va
 * igual de bé des d'on sigui. Els diccionaris s'importen estàticament, com ja
 * fan `lib/labels.ts` i `lib/notifications/types.ts`.
 *
 * Els tres van al bundle del servidor. Són els mateixos fitxers que ja carrega
 * l'app, i tenir-los tots tres a mà és el que permet que un mateix esdeveniment
 * —les novetats de la comunitat— surti en un idioma per a cada destinatari
 * dins del mateix bucle.
 */
const MESSAGES = { ca, es, en } as const;

/**
 * Mentre les plantilles segueixin escrites en català, TOTS els correus surten
 * en català.
 *
 * La fontaneria ja sap l'idioma de cada destinatari, però el text encara no
 * està traduït. Sense aquest interruptor, un client amb el castellà triat
 * rebria avui un correu en català amb les dates en castellà: pitjor que ara.
 *
 * El bloc 2 esborra aquesta constant i la línia que la mira. Fins llavors,
 * aquest fitxer no canvia ni un correu —que és justament el que s'havia de
 * poder demostrar—.
 */
const TEMPLATES_TRANSLATED = false;

/** Sense idioma, català. És el que fa que admin, professional, el visitant de
 *  /prova i l'avís al desenvolupador segueixin igual sense tocar-los. */
export function emailLocale(locale?: Locale | null): Locale {
  if (!TEMPLATES_TRANSLATED) return DEFAULT_LOCALE;
  return locale ?? DEFAULT_LOCALE;
}

/**
 * Els textos d'un correu en un idioma, i els formatadors lligats al mateix.
 *
 * Van junts a propòsit. La data i el servei es formataven a qui cridava
 * `notify()` —sempre en català— i arribaven a la plantilla com a cadena feta.
 * Amb això, la plantilla anglesa deia "Date and time: dilluns, 15 de març".
 * Ara el format es decideix aquí, on ja se sap en quin idioma s'escriu.
 */
export function emailI18n(locale?: Locale | null) {
  const l = emailLocale(locale);
  const messages = MESSAGES[l];
  const intl = intlLocale(l);

  return {
    locale: l,
    /** Traductor de l'arrel: `t("emails.reservationConfirmed.heading")`. */
    t: createTranslator({ locale: l, messages }),
    /**
     * Traductor d'un espai de noms concret.
     *
     * El `as never` és perquè next-intl tipa el nom de l'espai contra l'arbre
     * del diccionari i aquí arriba com a cadena. Les claus es comproven igual
     * amb `npm run i18n:check`, que és qui de debò les vigila.
     */
    ns: (namespace: string) =>
      createTranslator({ locale: l, messages, namespace: namespace as never }),

    /** "dilluns, 15 de març, a les 10:00" — el format llarg dels correus. */
    dateTime: (iso: string) =>
      new Intl.DateTimeFormat(intl, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: CENTER_TZ,
      }).format(new Date(iso)),

    /** "15 de març del 2026" — sense hora. */
    date: (iso: string) =>
      new Intl.DateTimeFormat(intl, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: CENTER_TZ,
      }).format(new Date(iso)),

    /** "10:00" a l'hora del centre. */
    time: (iso: string) =>
      new Intl.DateTimeFormat(intl, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: CENTER_TZ,
      }).format(new Date(iso)),

    /** Import en euros. */
    money: (n: number) =>
      new Intl.NumberFormat(intl, {
        style: "currency",
        currency: "EUR",
      }).format(n),

    /** El nom del servei en l'idioma de qui llegeix. */
    service: (type: string) =>
      createTranslator({ locale: l, messages, namespace: "labels.service" })(
        type as never,
      ),
  };
}

export type EmailI18n = ReturnType<typeof emailI18n>;

/**
 * Els correus parlen sempre en hora del centre, encara que qui els llegeixi
 * sigui a un altre fus: "tens sessió a les 10:00" vol dir les 10:00 de
 * Barcelona.
 */
const CENTER_TZ = "Europe/Madrid";
