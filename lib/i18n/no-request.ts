import { createTranslator } from "next-intl";
import ca from "@/messages/ca.json";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/config";

/**
 * Traduir fora del context d'una petició.
 *
 * Les pantalles treuen l'idioma del context de la petició (`getTranslations`),
 * però hi ha coses que no es renderitzen dins de cap: un correu el dispara un
 * cron o una Server Action que ja ha acabat de pintar, i el PDF d'un val el
 * genera un webhook de Stripe on no hi ha ni sessió ni cookies.
 *
 * `createTranslator` de next-intl és una funció pura —li dónes locale i
 * missatges i et torna el traductor— i va igual de bé des d'on sigui. Els
 * diccionaris s'importen estàticament, com ja fan `lib/labels.ts` i
 * `lib/notifications/types.ts`.
 *
 * Els tres van al bundle del servidor. Són els mateixos fitxers que ja carrega
 * l'app, i tenir-los tots tres a mà és el que permet que un mateix esdeveniment
 * —les novetats de la comunitat— surti en un idioma per a cada destinatari
 * dins del mateix bucle.
 */
const MESSAGES = { ca, es, en } as const;

/** Sense idioma, català. És el que fa que admin, professional, el visitant
 *  de /prova i l'avís al desenvolupador segueixin igual sense tocar-los. */
export function resolvedLocale(locale?: Locale | null): Locale {
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
export function staticI18n(locale?: Locale | null) {
  const l = resolvedLocale(locale);
  const messages = MESSAGES[l];
  const intl = intlLocale(l);

  return {
    locale: l,
    /** Traductor de l'arrel: `t("emails.reservationConfirmed.heading")`. */
    t: createTranslator({ locale: l, messages }),
    /**
     * Traductor d'un espai de noms concret.
     *
     * El tipus és a posta més ample que el de next-intl: allà l'espai de noms
     * es comprova contra l'arbre del diccionari, i aquí arriba com a cadena.
     * Qui vigila de debò que les claus existeixin —i que hi siguin als tres
     * idiomes— és `npm run i18n:check`, que entén aquesta forma.
     */
    ns: (namespace: string): StaticTranslator =>
      createTranslator({
        locale: l,
        messages,
        namespace: namespace as never,
      }) as unknown as StaticTranslator,

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

/** Un traductor: clau i, si cal, els seus paràmetres. */
export type StaticTranslator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export type StaticI18n = ReturnType<typeof staticI18n>;

/**
 * Tot això parla sempre en hora del centre, encara que qui ho llegeixi sigui a
 * un altre fus: "tens sessió a les 10:00" vol dir les 10:00 de Barcelona.
 */
const CENTER_TZ = "Europe/Madrid";
