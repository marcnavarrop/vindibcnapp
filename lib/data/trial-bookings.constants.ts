import type { TrainingServiceType } from "@/types/database";

/** Servei per defecte d'una sessió de prova (individual). Compartit
 *  client/servidor (sense `server-only`). */
export const TRIAL_SERVICE: TrainingServiceType = "ep_individual";

/** Serveis d'entrenament (mai fisioteràpia). */
export const TRAINING_SERVICES: TrainingServiceType[] = [
  "ep_individual",
  "ep_parejas",
  "grupo_reducido",
];

/**
 * La finestra en què es pot demanar una prova. Viu aquí, i no dins de
 * `trial-bookings.ts`, perquè el calendari públic també l'ha de dir en veu
 * alta ("cal un mínim de 24 h d'antelació") i és un component de client: si
 * cada banda es guardés el seu número, un dia dirien coses diferents.
 */
export const TRIAL_MIN_ADVANCE_HOURS = 24;
export const TRIAL_MAX_ADVANCE_DAYS = 30;

/**
 * Els motius pels quals una sol·licitud de prova no tira endavant.
 *
 * Codis, no frases: la pàgina /prova és pública i es veu en tres idiomes, i
 * qui decideix el motiu és el servidor. Mateix criteri que a les reserves.
 */
export type TrialErrorCode =
  | "noName"
  | "badEmail"
  | "badPhone"
  | "noSlot"
  | "noConsent"
  | "badDate"
  | "tooSoon"
  | "tooFar"
  | "slotTaken"
  | "duplicate"
  | "rateLimited"
  | "failed";
