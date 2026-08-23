import type { BookingFrequency } from "@/types/database";

/**
 * Les dates d'una sèrie. Sense servidor ni base de dades: aritmètica pura, per
 * poder-la raonar (i provar) sense muntar res.
 */

/** Dies que s'avancen a cada salt. `monthly` va per mes natural, no per 28 dies. */
export function nextOccurrence(from: Date, frequency: BookingFrequency): Date {
  const d = new Date(from);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else {
    // Mensual "el mateix dia del mes". Si el mes de destí no té aquell dia
    // (31 de gener + 1 mes), es queda a l'últim: mai salta al mes següent.
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return d;
}

/**
 * Genera els instants de la sèrie a partir del primer.
 *
 * S'atura al PRIMER dels dos límits que es compleixi: la data final o el
 * nombre d'ocurrències. Si es donen tots dos, mana el que arribi abans —que és
 * el que espera qui escriu "cada setmana, 10 sessions, fins al 30 de juny": si
 * el 30 de juny arriba a la setena, se'n fan set.
 *
 * `maxOccurrences` és un tall dur de seguretat: una data final llunyana amb
 * freqüència setmanal podria generar centenars de files i cap client vol
 * reservar tres anys de cop.
 */
export function generateOccurrences(opts: {
  first: Date;
  frequency: BookingFrequency;
  /** Data límit inclosa, en format YYYY-MM-DD (hora del centre). */
  endDate?: string | null;
  occurrenceCount?: number | null;
  maxOccurrences?: number;
}): Date[] {
  const { first, frequency } = opts;
  const cap = opts.maxOccurrences ?? 52;
  const limitCount = opts.occurrenceCount ?? Infinity;
  const out: Date[] = [];
  let current = new Date(first);

  while (out.length < Math.min(limitCount, cap)) {
    if (opts.endDate) {
      // Es compara per dia natural: una ocurrència que cau el mateix dia del
      // límit hi entra; l'endemà, no.
      const day = localDayString(current);
      if (day > opts.endDate) break;
    }
    out.push(new Date(current));
    current = nextOccurrence(current, frequency);
  }
  return out;
}

/** YYYY-MM-DD del dia local d'una data (sense passar per UTC). */
export function localDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Com ha quedat cada ocurrència després de resoldre-la.
 *
 * `ja_reservada` és la sessió d'origen: la que el client ja tenia reservada
 * abans de dir "repeteix-me-la". No es torna a reservar —ja hi és— però tampoc
 * és un fracàs: s'adopta a la sèrie. Barrejar-la amb `sense_places`, que és el
 * que passava, deixava la reserva original fora de la sèrie i, en cancel·lar-la
 * sencera, allà es quedava.
 */
export type OccurrenceStatus =
  | "confirmada"
  | "ja_reservada"
  | "alternativa_proposada"
  | "llista_espera"
  | "sense_places";

export type ResolvedOccurrence = {
  /** L'instant demanat originalment. */
  requestedAt: string;
  requestedTrainerId: string | null;
  status: OccurrenceStatus;
  /** Només a 'alternativa_proposada': què es proposa a canvi. */
  alternative?: {
    scheduledAt: string;
    trainerId: string;
    trainerName: string;
    /** Per explicar-ho a la UI sense recalcular-ho. */
    sameDay: boolean;
  };
  /** Motiu, per a les que no s'han pogut col·locar. */
  note?: string;
};

/** El resum que es pinta a l'assistent. */
export function summarize(occurrences: ResolvedOccurrence[]) {
  return {
    total: occurrences.length,
    confirmed: occurrences.filter((o) => o.status === "confirmada").length,
    alreadyBooked: occurrences.filter((o) => o.status === "ja_reservada").length,
    alternatives: occurrences.filter((o) => o.status === "alternativa_proposada")
      .length,
    waitlisted: occurrences.filter((o) => o.status === "llista_espera").length,
    unavailable: occurrences.filter((o) => o.status === "sense_places").length,
  };
}
