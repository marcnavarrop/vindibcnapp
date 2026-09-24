"use client";

import { useEffect } from "react";
import { announceBonosCollectable } from "@/lib/bono-events";

/**
 * Avisa la piloteta de «Bons» del menú de l'equip de quants bons del centre
 * queden per cobrar.
 *
 * AVISA EN MUNTAR-SE, I NO ÉS SILENCIAR
 *
 * El layout no es torna a pintar en navegar, o sigui que el número del menú és
 * la foto de la càrrega de la pàgina. Entrar a Bons el posa al dia amb el
 * recompte que acaba de fer el servidor: pot pujar tant com baixar.
 *
 * I TORNA A AVISAR QUAN CANVIA
 *
 * Cobrar o anul·lar acaba en un `revalidatePath` que torna a pintar la PÀGINA
 * i li porta un `count` nou. Aquest component és a la taula (o a la fitxa), que
 * sobreviu al canvi; la fila que s'ha cobrat, no.
 */
export function CollectableBonosAnnouncer({ count }: { count: number }) {
  useEffect(() => {
    announceBonosCollectable(count);
  }, [count]);

  return null;
}
