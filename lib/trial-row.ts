import { CENTER_TZ } from "@/lib/config";
import type { TrialBookingItem } from "@/lib/data/trial-bookings";

/** Una prova de la llista, amb l'hora ja escrita per al navegador. */
export type TrialRowView = TrialBookingItem & { when: string };

/**
 * L'hora es formata al SERVIDOR i en hora del CENTRE: a Vercel el servidor va
 * en UTC (sense `timeZone` cada prova sortia una o dues hores abans), i el
 * format curt de mes d'`Intl` no és igual a Node i a Chrome (l'error
 * d'hidratació #418). La fila no formata res.
 *
 * Fora del fitxer d'accions a propòsit: allà, cada funció exportada seria una
 * acció que el navegador podria cridar.
 */
export function toTrialRowView(t: TrialBookingItem): TrialRowView {
  return {
    ...t,
    when: new Intl.DateTimeFormat("ca-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: CENTER_TZ,
    }).format(new Date(t.scheduledAt)),
  };
}
