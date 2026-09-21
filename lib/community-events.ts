/**
 * Avís, dins de la pestanya, de què queda per mirar a la comunitat.
 *
 * Mateix problema i mateixa solució que `lib/support-events.ts`: la piloteta
 * viu al MENÚ (el layout) i el marcatge passa a la PÀGINA de Comunitat. El
 * layout no es torna a pintar en navegar-hi, així que sense això la piloteta es
 * quedaria encesa fins que algú recarregués, tot i haver-ho mirat ja.
 *
 * QUI L'HA DE LLANÇAR
 *
 * Un component que sobrevisqui al canvi que l'ha provocat. A suport la lliçó va
 * costar: l'avís el llançava la fila del tiquet, que en resoldre'l deixava de
 * complir el filtre i desapareixia, i l'efecte d'un component que es desmunta
 * en el mateix render no s'executa mai. Aquí el llança el marcador de la
 * pàgina, que hi és mentre hi siguis, i no cap `PollCard` ni cap targeta
 * d'anunci: aquelles es remunten en votar.
 *
 * Porta el número a dins —sempre 0, de moment— perquè qui l'escolta no hagi de
 * tornar a preguntar-ho al servidor.
 *
 * Va per `window` i no per un context de React pel mateix motiu que el de
 * suport: els dos components no comparteixen cap pare que no sigui l'arrel.
 */
export const COMMUNITY_SEEN = "vindi:community-seen";

export type CommunitySeenDetail = { unread: number };

/** Diu quants avisos de comunitat queden sense mirar ara mateix. */
export function announceCommunitySeen(unread: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CommunitySeenDetail>(COMMUNITY_SEEN, {
      detail: { unread },
    }),
  );
}
