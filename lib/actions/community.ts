"use server";

import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getCenterSettings } from "@/lib/data/center-settings";
import {
  countUnreadCommunity,
  markCommunitySeen,
} from "@/lib/data/community-seen";

/**
 * Les dues peticions de la piloteta de Comunitat.
 *
 * Van per acció i no com a prop del layout, i és la lliçó de la piloteta de
 * suport: `AppShell` és el marc comú i NO es torna a renderitzar en navegar
 * entre pantalles del client. Un número passat com a prop es quedaria ranci
 * exactament igual que s'hi va quedar aquell.
 *
 * Cap de les dues tomba res: viuen al menú, que surt a totes les pantalles.
 * Sense compte, simplement no hi ha piloteta.
 */

/** Quants avisos de comunitat no ha vist encara qui ha entrat. */
export async function unreadCommunityCountAction(): Promise<number> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.role !== "client") return 0;

    // Amb el mòdul apagat l'entrada del menú ni hi és, però es comprova
    // igualment: qui decideix què es compta no ha de dependre de qui pinta.
    const { modules } = await getCenterSettings();
    if (!modules.comunitat) return 0;

    const client = await getClientByProfile(viewer.id);
    if (!client) return 0;
    return await countUnreadCommunity(client.id);
  } catch {
    return 0;
  }
}

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

    const client = await getClientByProfile(viewer.id);
    if (!client) return 0;

    await markCommunitySeen(client.id);
    return 0;
  } catch {
    // Si el marcatge falla, val més deixar la piloteta encesa que apagar-la
    // mentint: el compte es tornarà a demanar al següent muntatge del menú.
    return -1;
  }
}
