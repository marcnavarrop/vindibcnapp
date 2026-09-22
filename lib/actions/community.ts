"use server";

import { getViewer } from "@/lib/auth";
import { getClientRefByProfile } from "@/lib/data/clients";
import { markCommunitySeen } from "@/lib/data/community-seen";

/**
 * El marcatge de la piloteta de Comunitat.
 *
 * El RECOMPTE ja no és aquí. Anava per acció perquè `AppShell` no es torna a
 * renderitzar en navegar i un número passat com a prop es quedaria ranci —cosa
 * certa—, però el preu era que el número arribava 999 ms després que la
 * pantalla, i dues vegades per obertura del menú en mòbil. Ara el calcula el
 * layout (`lib/data/client-badges.ts`) i la prop només és el valor de sortida
 * d'un magatzem compartit, que és el que evita que es quedi ranci. Marcar-ho
 * vist, en canvi, sí que és una escriptura de qui mira: es queda.
 */

/**
 * Marca la comunitat com a vista i torna el que queda, que sempre és 0.
 *
 * Es torna el número en comptes de no tornar res perquè qui crida l'envia tal
 * qual a la piloteta per `window`, sense haver de tornar a preguntar.
 *
 * El `client_id` surt de la SESSIÓ i no d'un paràmetre: si arribés de fora, el
 * navegador podria demanar que es marqués el d'algú altre. La RLS de la 0087 ho
 * pararia igualment —aquesta és la garantia de veritat—, però no té sentit
 * enviar-li una petició que ja sabem que no ha de passar.
 */
export async function markCommunitySeenAction(): Promise<number> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.role !== "client") return 0;

    // La fitxa sencera no cal: d'aquí només en surt l'id. Abans passava per
    // `getClientByProfile`, que baixa bons, reserves i pagaments per llegir
    // una columna.
    const client = await getClientRefByProfile(viewer.id);
    if (!client) return 0;

    await markCommunitySeen(client.id);
    return 0;
  } catch {
    // Si el marcatge falla, val més deixar la piloteta encesa que apagar-la
    // mentint: el -1 el descarta el magatzem, i el compte es tornarà a
    // calcular al servidor a la pròxima càrrega de la pàgina.
    return -1;
  }
}
