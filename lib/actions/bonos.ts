"use server";

import { getViewer } from "@/lib/auth";
import { countCollectableBonos } from "@/lib/data/bonos";

/**
 * Quants bons per pagar té qui ha entrat.
 *
 * Va per acció i no com a prop del layout, i és la lliçó que ja van deixar la
 * piloteta de suport i la de comunitat: `AppShell` és el marc comú i NO es
 * torna a renderitzar en navegar entre pantalles del client. Un número passat
 * des d'allà es quedaria ranci.
 *
 * Mai tomba res: viu al menú, que surt a totes les pantalles. Sense compte,
 * simplement no hi ha piloteta.
 */
export async function pendingBonoCountAction(): Promise<number> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.role !== "client") return 0;
    return await countCollectableBonos(viewer.id);
  } catch {
    return 0;
  }
}
