import "server-only";
import { getClientRefByProfile } from "@/lib/data/clients";
import { countUnreadCommunity } from "@/lib/data/community-seen";
import { countCollectableBonos } from "@/lib/data/bonos";
import { countUnreadExercises } from "@/lib/data/exercises-seen";
import type { ModuleFlags } from "@/lib/nav";

/**
 * Els números de les piloteta del menú del client, calculats al servidor.
 *
 * PER QUÈ AQUÍ I NO A CADA PILOTETA
 *
 * Abans cada piloteta es demanava el seu número amb una Server Action en
 * muntar-se, i el número arribava un segon després que la pantalla —mesurat:
 * 999 ms—. Pitjor encara en mòbil: del menú n'hi ha dues còpies muntades
 * (l'`<aside>` amagat i el calaix lliscant), o sigui que obrir el menú
 * tornava a disparar les dues peticions cada vegada.
 *
 * Calculat al layout, el número viatja dins de l'HTML i es pinta al primer
 * frame. I no és una consulta més per pantalla: el layout NO es torna a
 * renderitzar en navegar entre pàgines del client —al payload RSC d'una
 * navegació la seva ranura torna `null`—, que és exactament la cadència a la
 * qual disparava l'efecte d'abans.
 *
 * UNA SOLA LECTURA DE `clients`, I PRIMA
 *
 * Les dues consultes d'abans buscaven pel seu compte la fila del client. La de
 * comunitat, a més, hi arribava per `getClientByProfile`, que baixa la fitxa
 * SENCERA —bons, reserves amb el seu professional, i pagaments— per quedar-se
 * només amb l'`id`. Aquí es llegeixen dues columnes i prou, un sol cop, i les
 * dues xifres es compten en paral·lel.
 */
export type ClientBadgeCounts = {
  /** Avisos de comunitat sense mirar. */
  community: number;
  /** Bons que li queden per pagar. */
  bonos: number;
  /** Exercicis que li han assignat i encara no ha mirat. */
  exercicis: number;
};

const NONE: ClientBadgeCounts = { community: 0, bonos: 0, exercicis: 0 };

/**
 * Els dos números, o zeros si alguna cosa falla.
 *
 * No tomba mai. Això corre dins del layout de TOTA l'àrea de client: una
 * consulta que peti aquí s'enduria la pantalla sencera, i el que hi ha en joc
 * és una bola de 20 píxels. Sense número, simplement no hi ha piloteta —el
 * mateix criteri que ja tenien les accions que substitueix.
 */
export async function getClientBadgeCounts(
  profileId: string,
  /**
   * Amb el mòdul de comunitat apagat l'entrada del menú ni hi és, però el
   * recompte es salta igualment: qui decideix què es compta no ha de dependre
   * de qui ho pinta. Ve del layout, que ja té la configuració llegida.
   */
  modules: ModuleFlags,
): Promise<ClientBadgeCounts> {
  try {
    const client = await getClientRefByProfile(profileId);
    if (!client) return NONE;

    const [community, bonos, exercicis] = await Promise.all([
      modules.comunitat
        ? countUnreadCommunity(client.id, client.createdAt)
        : Promise.resolve(0),
      countCollectableBonos(client.id),
      // Sense mòdul que la pugui apagar: Exercicis hi és sempre.
      countUnreadExercises(client.id, client.createdAt),
    ]);

    return { community, bonos, exercicis };
  } catch {
    return NONE;
  }
}
