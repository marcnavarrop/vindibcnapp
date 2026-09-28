/**
 * Fins on mira enrere «Cal fer» i quantes files demana com a molt per llista.
 * Aquí i no a `lib/data/trainer-inbox.ts` perquè el manual també ho diu, i el
 * manual no pot importar un mòdul de servidor.
 */

/** Un mes: el que cal per tancar una liquidació. */
export const INBOX_DAYS = 30;
/** Sostre per consulta. Molt per sobre del que una agenda fa en un mes. */
export const INBOX_LIMIT = 200;
