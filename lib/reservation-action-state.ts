/**
 * El que tornen les accions de cancel·lar i marcar feta de l'agenda.
 *
 * Abans eren accions sense estat: el formulari es donava per bo en enviar-se
 * (`onSubmit`) i, si el servidor fallava, la pantalla deia «Reserva cancel·lada»
 * igualment —reproduït, en desenvolupament i en producció—. Ara la pantalla
 * espera la resposta: `ok` per dir que s'ha fet, `error` per dir per què no.
 *
 * Tipus pla, sense res de servidor: l'importen les accions i els components.
 */
export type ReservationActionState = { ok?: boolean; error?: string };

/** El missatge d'una excepció, per ensenyar-lo tal com ve (ja és en català). */
export function actionError(e: unknown, fallback: string): ReservationActionState {
  return { error: e instanceof Error && e.message ? e.message : fallback };
}
