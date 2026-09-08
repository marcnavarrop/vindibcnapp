/**
 * El mínim de caràcters d'una contrasenya.
 *
 * Viu en un mòdul neutre —sense `"use client"` ni `server-only`— perquè el
 * número el necessiten llocs dels dos costats: els formularis d'alta, de canvi
 * i de recuperació (navegador), la validació de l'alta i la del canvi
 * (servidor) i el manual d'ajuda, que l'explica al client.
 *
 * PER QUÈ ÉS UNA CONSTANT I NO UN 8 ESCRIT CINC VEGADES
 *
 * Perquè ja havia divergit. L'alta demanava 6 i el canvi de contrasenya 8, de
 * manera que algú es registrava amb una contrasenya que després no podia
 * repetir en canviar-la, i el manual havia d'explicar dos números diferents per
 * a la mateixa cosa. Amb un sol lloc, això no pot tornar a passar.
 *
 * Es va igualar cap AMUNT, a 8: baixar el del canvi a 6 hauria arreglat la
 * incoherència debilitant els comptes, que és arreglar-ho al revés.
 */
export const MIN_PASSWORD_LENGTH = 8;
