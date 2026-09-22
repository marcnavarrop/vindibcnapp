"use client";

import { useEffect } from "react";
import { markExercisesSeenAction } from "@/lib/actions/exercises";
import { announceExercisesSeen } from "@/lib/exercise-events";

/**
 * Deixa constància que el client ha mirat els seus exercicis, i apaga la
 * piloteta.
 *
 * VIU A LA PÀGINA I NO A CAP TARGETA, I AIXÒ ÉS LA LLIÇÓ DE SUPORT
 *
 * L'avís l'ha de llançar un component que SOBREVISQUI al canvi que el
 * provoca. A suport, l'avís el llançava la fila del tiquet, i en resoldre'l
 * aquella fila deixava de complir el filtre i desapareixia: l'efecte d'un
 * component que es desmunta en el mateix render no s'executa mai, i la
 * piloteta es quedava reclamant una feina ja feta.
 *
 * Aquí el perill equivalent seria penjar-ho d'una targeta d'exercici:
 * desplegar-la o apuntar-hi progrés les remunta. Aquest component no pinta res
 * i es queda tota l'estona que hi siguis, que és el que se li demana.
 *
 * No hi ha `revalidatePath` a l'acció a posta: marcar-ho vist no canvia res
 * del que s'està veient, i repintar la pàgina sencera per una data seria
 * moure-ho tot per no ensenyar res de nou.
 */
export function ExercisesSeenMarker() {
  useEffect(() => {
    // Sense comprovar si el component segueix muntat: qui escolta és la
    // piloteta del MENÚ, que no es desmunta quan marxes d'aquesta pàgina. Si
    // el marcatge acaba just després de navegar, l'avís encara ha d'arribar.
    markExercisesSeenAction().then(announceExercisesSeen, () => {
      // Silenci: la piloteta es queda com estava i el compte es tornarà a
      // calcular al servidor a la pròxima càrrega de la pàgina.
    });
  }, []);

  return null;
}
