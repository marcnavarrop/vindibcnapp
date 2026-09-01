/**
 * La finestra per cancel·lar una reserva.
 *
 * Estava escrita CINC vegades: dos cops al servidor (les dues branques de
 * `cancelClientReservation`) i tres a la interfície (el calendari del centre,
 * la llista de properes sessions de l'inici i el botó de cancel·lar). Les cinc
 * deien el mateix, però una regla copiada cinc cops és una regla que un dia
 * s'arregla a quatre.
 *
 * Sense `server-only`: la comproven els dos costats a posta. El client, per no
 * ensenyar un botó que no farà res; el servidor, perquè és qui mana i amagar
 * un botó no protegeix de res.
 */

/** Marge de cancel·lació en mil·lisegons. */
export function cancellationWindowMs(minCancellationHours: number): number {
  return minCancellationHours * 60 * 60 * 1000;
}

/**
 * ¿Encara s'hi és a temps?
 *
 * Amb el marge a 0 sempre es pot: és com el centre diu "sense restriccions".
 * `now` entra per paràmetre perquè es pugui provar sense tocar el rellotge.
 */
export function canCancelAt(
  scheduledAt: string | Date,
  minCancellationHours: number,
  now: number = Date.now(),
): boolean {
  if (minCancellationHours <= 0) return true;
  const at = new Date(scheduledAt).getTime();
  if (Number.isNaN(at)) return false;
  return at - now >= cancellationWindowMs(minCancellationHours);
}

/**
 * "Has arribat tard", com a error tipat i no com a frase.
 *
 * Abans les dues branques del servidor llançaven un `Error` amb el text en
 * català escrit a mà, i l'acció se'l empassava sencer i tornava un "failed"
 * genèric: qui arribava tard veia "no s'ha pogut completar l'operació" i es
 * quedava sense saber per què. Amb un error propi, l'acció el reconeix i pot
 * dir-ho de veritat, en l'idioma de qui llegeix.
 */
export class TooLateToCancelError extends Error {
  constructor(readonly minCancellationHours: number) {
    super(`too_late_to_cancel:${minCancellationHours}`);
    this.name = "TooLateToCancelError";
  }
}
