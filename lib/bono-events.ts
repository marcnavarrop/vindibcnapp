/**
 * Avís, dins de la pestanya, de quants bons queden per pagar.
 *
 * Mateix problema i mateixa solució que `lib/support-events.ts` i
 * `lib/community-events.ts`: la piloteta viu al MENÚ (el layout) i el que la
 * silencia passa a la PÀGINA. El layout no es torna a pintar en navegar-hi.
 *
 * QUI L'HA DE LLANÇAR
 *
 * Un component que sobrevisqui al canvi que el provoca. A suport la lliçó va
 * costar: l'avís el llançava la fila del tiquet, que en resoldre'l desapareixia,
 * i l'efecte d'un component que es desmunta en el mateix render no s'executa
 * mai. Aquí el llança el marcador de la pàgina de «Els meus bons», que hi és
 * mentre hi siguis.
 */
export const BONOS_SEEN = "vindi:bonos-seen";

export type BonosSeenDetail = { pending: number };

/** Diu quants bons per pagar queden reclamant atenció ara mateix. */
export function announceBonosSeen(pending: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BonosSeenDetail>(BONOS_SEEN, { detail: { pending } }),
  );
}

/**
 * Avís de quants bons de TOT el centre queden per cobrar: la piloteta de
 * «Bons» de l'admin i del professional.
 *
 * NO ÉS UN «JA HO HE VIST», I PER AIXÒ ÉS UN ALTRE AVÍS
 *
 * Per al client, la piloteta és un recordatori i se silencia mentre és a
 * «Els meus bons». Per a l'equip és una cua de feina, com la de suport: ha de
 * dir sempre el número de debò, i només baixa quan algú cobra o anul·la.
 *
 * El llança `CollectableBonosAnnouncer`, que viu a la TAULA de bons i no a la
 * fila: en cobrar amb el filtre «Pendents», la fila desapareix en el mateix
 * render i el seu efecte no s'arribaria a executar mai. La lliçó de suport.
 */
export const BONOS_COLLECTABLE = "vindi:bonos-collectable";

export type BonosCollectableDetail = { collectable: number };

/** Diu quants bons del centre queden per cobrar ara mateix. */
export function announceBonosCollectable(collectable: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BonosCollectableDetail>(BONOS_COLLECTABLE, {
      detail: { collectable },
    }),
  );
}
