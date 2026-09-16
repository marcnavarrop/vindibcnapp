/**
 * Avís, dins de la pestanya, de quants tiquets de suport queden oberts.
 *
 * La piloteta del botó flotant i la safata de `/admin/suport` viuen a dos
 * llocs de l'arbre que no es parlen: el botó és al marc comú (el layout) i la
 * llista és a la pàgina. Quan l'admin resol un tiquet, el `revalidatePath` de
 * l'acció torna a pintar la PÀGINA —els recomptes hi queden bé— però no toca
 * el layout, i el botó es quedava amb el número d'abans fins que algú
 * recarregués.
 *
 * L'avís el llança la SAFATA i no el desplegable de cada fila, encara que sigui
 * el desplegable qui fa el canvi: en resoldre un tiquet, la seva fila deixa de
 * complir el filtre «Pendents» i desapareix, i un efecte d'un component que
 * s'està desmuntant en el mateix render no arriba a executar-se mai. La safata,
 * en canvi, es queda: quan li tornen els tiquets nous, compta i avisa.
 *
 * Porta el número a dins perquè qui l'escolta no hagi de tornar a preguntar-ho
 * al servidor: la safata ja té la llista sencera a la mà.
 *
 * Va per `window` i no per un context de React a posta: els dos components no
 * comparteixen cap pare que no sigui l'arrel de l'aplicació, i embolcallar-la
 * sencera per a un número seria pagar molt per poc.
 */
export const SUPPORT_CHANGED = "vindi:support-changed";

export type SupportChangedDetail = { open: number };

/** Diu quants tiquets oberts hi ha ara mateix. */
export function announceSupportChange(open: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SupportChangedDetail>(SUPPORT_CHANGED, {
      detail: { open },
    }),
  );
}
