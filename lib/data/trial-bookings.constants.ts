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
