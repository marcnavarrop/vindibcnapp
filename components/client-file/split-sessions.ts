import type { ClientReservation } from "@/lib/data/clients";

/**
 * Les sessions d'un client en tres piles: properes, passades i cancel·lades.
 *
 * Abans era una sola llista de la més llunyana a la més antiga, sense hora ni
 * professional i amb les cancel·lades barrejades: la propera quedava al mig, i
 * en un client real de producció hi havia 91 files, la majoria cancel·lades.
 * `now` arriba del servidor perquè la primera pintada del navegador digui el
 * mateix que la del servidor.
 */
export function splitSessions(reservations: ClientReservation[], now: string) {
  const upcoming: ClientReservation[] = [];
  const past: ClientReservation[] = [];
  const cancelled: ClientReservation[] = [];
  for (const r of reservations) {
    if (r.status === "cancelled") cancelled.push(r);
    else if (r.status === "booked" && Date.parse(r.scheduledAt) >= Date.parse(now)) upcoming.push(r);
    else past.push(r);
  }
  upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  past.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  cancelled.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return { upcoming, past, cancelled };
}
