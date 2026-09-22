"use server";

import { getViewer } from "@/lib/auth";
import { getClientRefByProfile } from "@/lib/data/clients";
import { markExercisesSeen } from "@/lib/data/exercises-seen";

/**
 * El marcatge de la piloteta d'Exercicis.
 *
 * Aquí NO hi ha cap acció de recompte, a diferència de com va néixer la de
 * comunitat: el número el calcula el layout (`lib/data/client-badges.ts`) i
 * baixa dins de l'HTML. Marcar-ho vist, en canvi, és una escriptura de qui
 * mira i ha de passar pel servidor.
 */

/**
 * Marca els exercicis com a vistos i torna el que queda, que sempre és 0.
 *
 * Es torna el número en comptes de no tornar res perquè qui crida l'envia tal
 * qual a la piloteta per `window`, sense haver de tornar a preguntar.
 *
 * El `client_id` surt de la SESSIÓ i no d'un paràmetre: si arribés de fora, el
 * navegador podria demanar que es marqués el d'algú altre. La RLS de la 0089
 * ho pararia igualment —aquesta és la garantia de veritat—, però no té sentit
 * enviar-li una petició que ja sabem que no ha de passar.
 */
export async function markExercisesSeenAction(): Promise<number> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.role !== "client") return 0;

    const client = await getClientRefByProfile(viewer.id);
    if (!client) return 0;

    await markExercisesSeen(client.id);
    return 0;
  } catch {
    // Si el marcatge falla, val més deixar la piloteta encesa que apagar-la
    // mentint: el -1 el descarta el magatzem, i el compte es tornarà a
    // calcular al servidor a la pròxima càrrega de la pàgina.
    return -1;
  }
}
