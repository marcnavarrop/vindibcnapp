/**
 * El límit de mida d'un document del client.
 *
 * Viu aquí, en un mòdul sense `"use client"` ni `server-only`, perquè el
 * número el necessiten TRES llocs que no poden compartir cap altre fitxer: el
 * formulari de pujada (client), la validació de l'acció (servidor) i el manual
 * d'ajuda (servidor). El tenien escrit cadascú pel seu compte.
 *
 * El primer intent va ser exportar-lo del formulari i importar-lo des del
 * manual, i no funciona: Next substitueix les exportacions d'un mòdul de client
 * per una referència, i al servidor no hi arribava el 15 sinó un proxy que
 * s'imprimia com un error enmig del text. Un mòdul neutre és l'única manera que
 * les dues bandes en llegeixin el mateix valor.
 */
export const DOCUMENT_MAX_MB = 15;

export const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;
