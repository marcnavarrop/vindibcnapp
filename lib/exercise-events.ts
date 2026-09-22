/**
 * Avís, dins de la pestanya, de què queda per mirar dels exercicis.
 *
 * Mateix problema i mateixa solució que `lib/community-events.ts`: la piloteta
 * viu al MENÚ i el marcatge passa a la PÀGINA d'Exercicis. El layout no es
 * torna a pintar en navegar-hi, així que sense això la piloteta es quedaria
 * encesa fins que algú recarregués, tot i haver-ho mirat ja.
 *
 * QUI L'HA DE LLANÇAR
 *
 * Un component que sobrevisqui al canvi que l'ha provocat. A suport la lliçó
 * va costar: l'avís el llançava la fila del tiquet, que en resoldre'l deixava
 * de complir el filtre i desapareixia, i l'efecte d'un component que es
 * desmunta en el mateix render no s'executa mai. Aquí el llança el marcador de
 * la pàgina, que hi és mentre hi siguis, i no cap targeta d'exercici: aquelles
 * es remunten en desplegar-les o en apuntar-hi progrés.
 *
 * Porta el número a dins —sempre 0, de moment— perquè qui l'escolta no hagi de
 * tornar a preguntar-ho al servidor.
 */
export const EXERCISES_SEEN = "vindi:exercises-seen";

export type ExercisesSeenDetail = { unread: number };

/** Diu quants exercicis queden sense mirar ara mateix. */
export function announceExercisesSeen(unread: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ExercisesSeenDetail>(EXERCISES_SEEN, {
      detail: { unread },
    }),
  );
}
