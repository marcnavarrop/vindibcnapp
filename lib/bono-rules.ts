/**
 * La regla de qui pot anul·lar un bo, i per què no.
 *
 * VIU AQUÍ I NO A `lib/data/bonos.ts` PERQUÈ LA NECESSITEN LES DUES BANDES
 *
 * La pantalla l'ha de saber per decidir si pinta el botó, i el servidor per
 * comprovar-ho abans d'escriure. `lib/data/bonos.ts` comença amb `server-only`
 * —hi ha la clau de servei a tocar—, així que una taula amb `"use client"` no
 * en pot importar res. Aquest fitxer és pura aritmètica sobre camps que ja
 * viatgen al navegador: cap consulta, cap secret.
 *
 * Amb una còpia a cada banda, el dia que la regla canviï una pantalla oferiria
 * una cosa que el servidor rebutja, i qui la premés rebria un error en comptes
 * d'un botó que no hi és.
 */
import type { BonoStatus } from "@/types/database";

/** Per què un bo NO es pot anul·lar. Null = sí que es pot. */
export type CancelBlock =
  | "not_cancellable_status"
  | "sessions_used"
  | "subscription"
  | "needs_admin";

export type CancelSubject = {
  status: BonoStatus;
  remainingSessions: number;
  totalSessions: number;
  subscriptionId: string | null;
};

/**
 * La regla, sencera i en un sol lloc.
 *
 * `isAdmin` decideix l'últim cas i no els altres: un bo actiu ja s'ha cobrat, i
 * a `payments` no hi ha cap manera d'anotar una devolució —`amount` té un
 * CHECK (amount >= 0)—. Anul·lar-lo és una esmena comptable i és de l'admin.
 */
export function cancelBlockFor(
  b: CancelSubject,
  isAdmin: boolean,
): CancelBlock | null {
  if (b.status !== "pending_payment" && b.status !== "active")
    return "not_cancellable_status";
  // Reservar descompta a l'instant (0084), així que un bo intacte és també un
  // bo sense cap reserva viva. Anul·lar no pot esborrar feina ja feta.
  if (b.remainingSessions !== b.totalSessions) return "sessions_used";
  // El mes d'una subscripció té el seu camí de baixa.
  if (b.subscriptionId !== null) return "subscription";
  if (b.status === "active" && !isAdmin) return "needs_admin";
  return null;
}

/** El motiu, dit a qui el llegirà. */
export const CANCEL_BLOCK_LABELS: Record<CancelBlock, string> = {
  not_cancellable_status:
    "Només es poden anul·lar els bons pendents de pagament o actius.",
  sessions_used: "Aquest bo ja té sessions gastades i no es pot anul·lar.",
  subscription:
    "És el mes d'una subscripció: cal donar-la de baixa des de la subscripció.",
  needs_admin:
    "Aquest bo ja està cobrat. Anul·lar-lo és cosa de l'administració.",
};
