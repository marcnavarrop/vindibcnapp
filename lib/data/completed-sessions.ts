import "server-only";
import { createClient } from "@/lib/supabase/server";
import { centerLocalToInstant, centerDateStr } from "@/lib/center-time";
import type { ServiceType } from "@/types/database";

/**
 * Sessions completades d'un professional dins d'un període.
 *
 * Viu en un mòdul propi perquè és el mateix càlcul per a Liquidacions i per a
 * Bonus, i tenir-ne dues còpies volia dir arreglar cada error dues vegades —
 * que és exactament el que va passar amb la zona horària.
 *
 * LES DE CORTESIA NO HI ENTREN (0070). Una sessió regalada no genera ingrés per
 * al centre, i el criteri acordat és que tampoc generi retribució: el
 * professional ja va cobrar per la sessió original que sí que va gastar bo, i
 * la de reposició no ha de sumar una segona vegada encara que hagi ocupat una
 * franja física diferent. Es filtra AQUÍ i no a cada cridant perquè Liquidacions
 * i Bonus comparteixen aquesta funció: filtrar-ho a fora voldria dir fer-ho dues
 * vegades i que un dia només se'n corregís una —és exactament el motiu pel qual
 * aquest mòdul existeix.
 *
 * ZONA HORÀRIA: un període es dona en dates de calendari ("de l'1 al 31
 * d'agost") i el dia natural va de mitjanit a mitjanit DEL CENTRE, no del
 * servidor. Amb `new Date("2026-08-01T00:00:00")` la finestra sortia en hora
 * del procés —UTC a Vercel— i es desplaçava una o dues hores: una sessió de la
 * matinada del dia 1 queia al mes anterior i una de la matinada del dia 1 del
 * mes següent es comptava en aquest. No es perdien diners, s'imputaven al
 * període equivocat; al bonus, on els trams són progressius i el període és
 * anual, això podia canviar l'import final.
 */

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type CompletedSession = {
  /** Dia natural del centre (YYYY-MM-DD): el que decideix quina tarifa/pes s'aplica. */
  day: string;
  serviceType: ServiceType;
};

/**
 * Suma dies a una data de calendari. Aritmètica pura sobre la cadena: la `Z`
 * és explícita i només s'hi fan servir mètodes UTC, així que no depèn de cap
 * zona horària ni la introdueix.
 */
export function shiftDay(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Límits absoluts d'un període expressat en dates del centre. */
export function periodBounds(
  periodStart: string,
  periodEnd: string,
): { fromISO: string; toISO: string } {
  return {
    fromISO: centerLocalToInstant(periodStart, "00:00").toISOString(),
    // Mitjanit del dia SEGÜENT al final, exclosa: així hi entra tot l'últim dia.
    toISO: centerLocalToInstant(shiftDay(periodEnd, 1), "00:00").toISOString(),
  };
}

export async function completedSessions(
  trainerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CompletedSession[]> {
  const { fromISO, toISO } = periodBounds(periodStart, periodEnd);

  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return getStore()
      .reservations.filter(
        (r) =>
          r.trainer_id === trainerId &&
          r.status === "completed" &&
          !r.is_complimentary &&
          r.scheduled_at >= fromISO &&
          r.scheduled_at < toISO,
      )
      .map((r) => ({
        day: centerDateStr(new Date(r.scheduled_at)),
        serviceType: r.service_type,
      }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("scheduled_at, service_type")
    .eq("trainer_id", trainerId)
    .eq("status", "completed")
    .eq("is_complimentary", false)
    .gte("scheduled_at", fromISO)
    .lt("scheduled_at", toISO);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    day: centerDateStr(new Date(r.scheduled_at)),
    serviceType: r.service_type,
  }));
}
