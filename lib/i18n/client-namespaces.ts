/**
 * QUINS MISSATGES VIATGEN AL NAVEGADOR
 *
 * `NextIntlClientProvider` sense `messages` hi enviava el diccionari sencer
 * (~65 kB per pàgina i idioma: correus, PDF del val, pàgines legals…), quan els
 * components de client de cada àrea en fan servir una part. Ara cada layout amb
 * proveïdor n'envia NOMÉS els namespaces d'aquestes llistes. El que es tradueix
 * al servidor (`getTranslations`, correus, PDF, legals) no passa pel proveïdor i
 * no en depèn.
 *
 * QUI LES MANTÉ AL DIA: `npm run i18n:client` (al `prebuild`). Recorre, des de
 * cada `page`/`layout`/`loading`/`error`/`not-found`/`template` de l'àrea i
 * seguint els imports (també els `import()`), tots els mòduls "use client", en
 * treu els `useTranslations("…")` i falla si n'hi ha cap que aquesta llista no
 * cobreixi. Una entrada cobreix la seva branca sencera: `reservas` cobreix
 * `reservas.errors`.
 *
 * Mòdul pur, sense `server-only`: el llegeix també la comprovació.
 */

/** L'àrea del client (`app/(client)`). */
export const CLIENT_AREA_NAMESPACES = [
  "awaiting",
  "bonos.buy",
  "bonos.mine",
  "comunitat.poll",
  "config.email",
  "config.notifications",
  "config.password",
  "config.privacy",
  "config.profile",
  "contact",
  "documents",
  "gifts",
  "growth.gift",
  "growth.referral",
  "home.next",
  "labels.calendar",
  "labels.gender",
  "labels.service",
  "legal",
  "nav",
  "picker",
  "redeem",
  "reservas",
  "wizard.frequency",
  "workouts",
] as const;

/** Login, registre i contrasenya oblidada (`app/(auth)`). */
export const AUTH_NAMESPACES = [
  "authErrors",
  "config.profile",
  "contact",
  "forgotPassword",
  "labels.gender",
  "login",
  "register",
] as const;

/** Les pantalles d'aterratge dels correus de compte (`app/auth`). */
export const AUTH_LANDING_NAMESPACES = ["authErrors", "confirmEmail", "updatePassword"] as const;

/** La sessió de prova pública (`app/prova`). */
export const TRIAL_NAMESPACES = ["contact", "trial"] as const;

/** Quina llista fa servir cada layout. La comprovació la llegeix d'aquí. */
export const PROVIDER_NAMESPACES: Record<string, readonly string[]> = {
  "app/(client)": CLIENT_AREA_NAMESPACES,
  "app/(auth)": AUTH_NAMESPACES,
  "app/auth": AUTH_LANDING_NAMESPACES,
  "app/prova": TRIAL_NAMESPACES,
};

type Messages = Record<string, unknown>;

/**
 * Una còpia dels missatges amb només aquestes branques (rutes amb punt:
 * `labels.service`). Una ruta que no existeix es deixa estar en silenci: qui
 * vigila que existeixin és `i18n:client`, que mira els tres diccionaris.
 */
export function pickMessages(messages: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = {};
  for (const ns of namespaces) {
    const parts = ns.split(".");
    let src: unknown = messages;
    for (const p of parts) src = src && typeof src === "object" ? (src as Messages)[p] : undefined;
    if (src === undefined) continue;
    let dst = out;
    parts.slice(0, -1).forEach((p) => {
      if (typeof dst[p] !== "object" || dst[p] === null) dst[p] = {};
      dst = dst[p] as Messages;
    });
    dst[parts[parts.length - 1]] = src;
  }
  return out;
}
