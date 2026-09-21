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
