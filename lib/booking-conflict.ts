import { SERVICE_LABELS, formatTime, sessionDayParts } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

/**
 * QUAN UNA RESERVA NO HI CAP (0105)
 *
 * La regla de producte: un client no pot tenir mai dues sessions vives que es
 * trepitgin, les reservi qui les reservi. L'aplicació ho mira abans (per
 * solapament, a tots els camins) i la base ho torna a mirar: el motiu
 * `client_overlap` de les funcions de reservar i de moure, i la constraint
 * `reservations_no_client_overlap` per a la cursa.
 *
 * Aquí també hi ha els altres tres motius de la base que fins ara el client
 * veia com «No s'ha pogut completar l'operació»: la franja s'ha ocupat, el grup
 * s'ha omplert o el bo s'ha quedat sense sessions mentre reservava.
 *
 * Mòdul pur, sense `server-only`: el fan servir les reserves i la llista
 * d'espera, i el que diu ha de ser el mateix als dos llocs.
 */

/** Els codis que l'àrea del client tradueix (`reservas.errors.*`, ca/es/en). */
export type BookingConflictCode = "clientOverlap" | "slotTaken" | "groupFull" | "noSessions";

/** El nom de la constraint de la 0105, per distingir-la de la de la 0082. */
export const CLIENT_OVERLAP_CONSTRAINT = "reservations_no_client_overlap";

/** El motiu de la base, en codi del client. Null si no és cap d'aquests quatre. */
export function conflictCodeOf(reason: unknown): BookingConflictCode | null {
  switch (reason) {
    case "client_overlap":
      return "clientOverlap";
    case "taken":
      return "slotTaken";
    case "full":
      return "groupFull";
    case "no_sessions":
      return "noSessions";
    default:
      return null;
  }
}

/**
 * Si un error de la base és la constraint del client (23P01 de la 0105) i no
 * la del professional (la 0082 dona el mateix codi). PostgREST porta el nom de
 * la constraint al missatge.
 */
export function isClientOverlapDbError(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && e.code === "23P01" && (e.message ?? "").includes(CLIENT_OVERLAP_CONSTRAINT);
}

/**
 * Un conflicte que el client llegeix en el seu idioma. El missatge és el de
 * l'equip, en català, per als registres.
 */
export class BookingConflictError extends Error {
  constructor(public readonly code: BookingConflictCode, message?: string) {
    super(message ?? TEAM_MESSAGE[code]);
    this.name = "BookingConflictError";
  }
}

/** El que llegeix l'equip, en català, com tota la seva àrea. */
const TEAM_MESSAGE: Record<BookingConflictCode, string> = {
  clientOverlap: "Aquest client ja té una altra sessió que es trepitja amb aquesta hora.",
  slotTaken: "Aquesta franja ja està ocupada.",
  groupFull: "El grup d'aquesta franja ja està complet.",
  noSessions: "Aquest bo no té sessions disponibles.",
};

/** La sessió amb què xoca, perquè l'equip sàpiga quina és sense anar-la a buscar. */
export function clientOverlapMessage(clash?: { scheduled_at: string; service_type: ServiceType } | null): string {
  if (!clash) return TEAM_MESSAGE.clientOverlap;
  const d = sessionDayParts(clash.scheduled_at);
  return `Aquest client ja té una altra sessió que es trepitja amb aquesta hora (${d.weekday} ${d.day} ${d.month}, ${formatTime(clash.scheduled_at)} · ${SERVICE_LABELS[clash.service_type]}).`;
}
