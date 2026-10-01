/**
 * LES CONTES DEMO, separades de les reals (pas 1 del pla de l'entorn PRE).
 *
 * Mentre els comptes de demostració visquin a producció, un client real no ha
 * de poder VEURE ni RESERVAR amb l'Entrenador Demo o el Fisio Demo (calendari,
 * llista d'espera, sèries, cerca de forat), ni demanar-hi una prova a /prova; i
 * el Client Demo només reserva amb professionals demo. Així el mode PRE segueix
 * funcionant entre els tres comptes demo sense tocar l'agenda ni la caixa de
 * ningú real.
 *
 * Mòdul PUR (sense `server-only`): el fan servir el servidor per rebutjar i el
 * calendari del client per no ensenyar el que el servidor rebutjaria. Els ids
 * són els de `lib/pre-mode.ts` (que en treu els seus d'aquí); no són secrets.
 *
 * Quan l'entorn PRE existeixi i els comptes demo s'hagin esborrat de
 * producció, aquestes llistes no casaran amb res i la regla no farà res.
 */

/** Perfils (= auth.users) dels professionals demo. */
export const DEMO_TRAINER_IDS: readonly string[] = [
  "5119e112-74af-4c85-862b-829f6d726ea2", // Entrenador Demo
  "1c36928b-0668-4377-a5d8-c7befb2d78bc", // Fisio Demo
];

/** Perfil del Client Demo. */
export const DEMO_CLIENT_PROFILE_ID = "d3b42dcb-7c11-4431-abc0-723b21add106";
/** La seva fitxa a `clients` (el que porten les reserves, els bons…). */
export const DEMO_CLIENT_ID = "84fa4786-3307-48ce-9bbf-e45c49f2fe7e";

export function isDemoTrainer(trainerId: string | null | undefined): boolean {
  return !!trainerId && DEMO_TRAINER_IDS.includes(trainerId);
}

/** `clientId` és el de `clients` (o el perfil del Client Demo). */
export function isDemoClient(clientId: string | null | undefined): boolean {
  return clientId === DEMO_CLIENT_ID || clientId === DEMO_CLIENT_PROFILE_ID;
}

/**
 * ¿Aquest client pot fer servir aquest professional? Demo amb demo i real amb
 * real. `clientId` null = no se sap qui és (no s'aplica: el servidor sempre ho
 * sap). `trainerId` null = «m'és igual qui» (a la cua): la promoció ho torna a
 * mirar amb el professional real de la franja.
 */
export function demoCompatible(clientId: string | null, trainerId: string | null): boolean {
  if (!clientId || !trainerId) return true;
  return isDemoClient(clientId) === isDemoTrainer(trainerId);
}

/** Per a qui no té compte (/prova): mai un professional demo. */
export function publicTrainer(trainerId: string | null | undefined): boolean {
  return !isDemoTrainer(trainerId);
}
