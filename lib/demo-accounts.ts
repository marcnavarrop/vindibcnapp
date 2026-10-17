/**
 * LES CONTES DEMO, separades de les reals.
 *
 * QUINS SÓN DEMO HO DIU LA BASE: `demo_profiles` (0110), l'única font des de la
 * 0121. Aquí no hi ha cap id: les regles reben el «món demo» que en llegeix el
 * servidor (`getDemoWorld()`, lib/data/demo-world.ts, una lectura per petició)
 * i són funcions pures. Si la lectura falla, el món és buit i TOTHOM compta com
 * a REAL: mai es tracta un compte com a demo per error.
 *
 * Mentre els comptes de demostració visquin a producció, un client real no ha
 * de poder VEURE ni RESERVAR amb un professional demo (calendari, llista
 * d'espera, sèries, cerca de forat), ni demanar-hi una prova a /prova; i un
 * client demo només reserva amb professionals demo.
 *
 * Mòdul PUR (sense `server-only`): el fa servir el servidor per rebutjar, i el
 * formulari d'assignar professional per no oferir el que el servidor
 * rebutjaria (rep el món ja llegit, mai el llegeix ell).
 *
 * Els tres comptes als quals pot saltar el mode PRE són una altra cosa: una
 * llista blanca al codi (lib/pre-accounts.ts) que, a més, ha de coincidir amb
 * aquesta taula.
 */

export type DemoWorld = {
  /** Perfils demo (professionals i clients). */
  profileIds: ReadonlySet<string>;
  /** Fitxes `clients` dels perfils demo. */
  clientIds: ReadonlySet<string>;
};

/** Sense demo: el que es fa servir si no s'ha pogut llegir. Tothom és real. */
export const REAL_WORLD: DemoWorld = { profileIds: new Set(), clientIds: new Set() };

export function isDemoTrainer(w: DemoWorld, trainerId: string | null | undefined): boolean {
  return !!trainerId && w.profileIds.has(trainerId);
}

/** `clientId` és el de `clients` (o el perfil d'un client demo). */
export function isDemoClient(w: DemoWorld, clientId: string | null | undefined): boolean {
  return !!clientId && (w.clientIds.has(clientId) || w.profileIds.has(clientId));
}

/**
 * ¿Aquest client pot fer servir aquest professional? Demo amb demo i real amb
 * real. `clientId` null = no se sap qui és (no s'aplica: el servidor sempre ho
 * sap). `trainerId` null = «m'és igual qui» (a la cua): la promoció ho torna a
 * mirar amb el professional real de la franja.
 */
export function demoCompatible(w: DemoWorld, clientId: string | null, trainerId: string | null): boolean {
  if (!clientId || !trainerId) return true;
  return isDemoClient(w, clientId) === isDemoTrainer(w, trainerId);
}

/**
 * ¿Es pot ASSIGNAR aquest professional a aquest client? La mateixa regla que en
 * reservar (`demoCompatible`), però aquí `clientId` null vol dir un client NOU,
 * que sempre és real (un compte nou no és mai a `demo_profiles` en néixer).
 *
 *   · Sense professional («sense assignar»): sempre.
 *   · Client demo → només un professional demo.
 *   · Client real → mai un professional demo.
 */
export function demoAssignmentAllowed(w: DemoWorld, clientId: string | null, trainerId: string | null): boolean {
  if (!trainerId) return true;
  const demoClient = clientId ? isDemoClient(w, clientId) : false;
  return demoClient === isDemoTrainer(w, trainerId);
}

/** El que es diu, en català, quan `demoAssignmentAllowed` diu que no. */
export const DEMO_ASSIGNMENT_ERROR =
  "Els comptes de demostració només van entre ells: a un client de demo només se li pot assignar un professional de demo (o cap), i a un client real, mai un professional de demo.";

/** Per a qui no té compte (/prova): mai un professional demo. */
export function publicTrainer(w: DemoWorld, trainerId: string | null | undefined): boolean {
  return !isDemoTrainer(w, trainerId);
}
