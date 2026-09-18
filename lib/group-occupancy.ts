import { GROUP_CAPACITY } from "@/lib/labels";

export type OccupancyStatus = "free" | "almost_full" | "full";

/**
 * Com de ple està un grup reduït.
 *   free        → 1–2/4  places lliures, convida a apuntar-s'hi
 *   almost_full → 3/4    gairebé ple
 *   full        → 4/4    complet
 *
 * ABANS AIXÒ ERA UN SEMÀFOR DE COLORS, I JA NO HO ÉS
 *
 * Cada estat tenia el seu joc de colors —verd, ambre, vermell— i pintava la
 * fitxa sencera als dos calendaris. Funcionava per dir com de plena estava una
 * sessió, però tenia un efecte que no es va veure fins que hi va haver grups de
 * debò: els grups eren l'únic servei sense color propi. Tres grups seguits en
 * sortien de tres colors, i el color, que a la resta de l'app diu QUÈ és una
 * sessió, en aquests deia una altra cosa.
 *
 * Ara el color d'un grup surt de la paleta de serveis com el de qualsevol altre
 * (Configuració → Colors → «Grup reduït»), i l'ocupació es llegeix on sempre ha
 * estat escrita igualment: al comptador «2/4» i a l'etiqueta que l'acompanya
 * («Gairebé ple», «Complet», «Plaça lliure»). No s'ha perdut cap informació;
 * ha deixat de dir-se dues vegades i de barallar-se amb el color del servei.
 *
 * Per això aquest mòdul ja no exporta cap paleta: el que en queda és la
 * pregunta, i qui la fa serveix per triar el TEXT, no el color.
 */
export function getOccupancyStatus(count: number): OccupancyStatus {
  if (count >= GROUP_CAPACITY) return "full";
  if (count >= GROUP_CAPACITY - 1) return "almost_full";
  return "free";
}
