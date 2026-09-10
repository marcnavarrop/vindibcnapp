import { centerDateStr, centerHour } from "@/lib/center-time";

/**
 * Quan pot enviar avisos el cron diari.
 *
 * Càlcul (gairebé) pur: no llegeix la base ni el rellotge, l'instant li arriba
 * de fora. Mateix criteri que `lib/subscription-cycle.ts` —"una funció que sap
 * quin dia és avui no es pot provar"— i per això aquesta lògica viu aquí i no
 * dins del route handler.
 *
 * ─── EL PROBLEMA QUE RESOL ───
 *
 * La guarda dels avisos era `horaLocal < reminderHourLocal`. Amb UNA SOLA
 * passada al dia, això no vol dir "encara és aviat": vol dir "avui no s'envia
 * mai", perquè no vindrà cap passada posterior a esmenar-ho.
 *
 * I no era teòric. El cron corre a les 18:00 UTC i `reminder_hour_local` val 20
 * per defecte:
 *
 *   · A l'estiu (CEST, UTC+2), 18:00 UTC són les 20:00 a Madrid. `20 < 20` és
 *     fals i s'enviava — amb un marge de ZERO hores.
 *   · A l'hivern (CET, UTC+1) són les 19:00. `19 < 20` és cert i es frenava.
 *     Cada dia, del ~25 d'octubre al ~28 de març: ni recordatoris de sessió, ni
 *     resums d'agenda, ni avisos de caducitat. En silenci.
 *
 * ─── LA CORRECCIÓ ───
 *
 * Frenar només si de debò queda avui una passada que caigui ja a l'hora bona.
 * Amb una passada al dia no en queda mai, així que s'envia: val més un avís una
 * hora abans que cap avís. El dia que se'n programi una segona a `vercel.json`,
 * s'afegeix a `CRON_UTC_HOURS` i la guarda torna a fer el que sempre va voler
 * fer, sense tocar res més.
 */

/** Les hores UTC a què corre el cron. Ha de coincidir amb `vercel.json`. */
export const CRON_UTC_HOURS = [18];

/** Marge per no confondre la passada d'ara amb una de futura si s'avança uns segons. */
const RUN_TOLERANCE_MS = 5 * 60_000;

/**
 * Queda avui —dia del CENTRE— una altra passada del cron que caigui a l'hora
 * configurada o més tard?
 */
export function hiHaPassadaMillorAvui(
  now: Date,
  reminderHourLocal: number,
  cronUtcHours: number[] = CRON_UTC_HOURS,
): boolean {
  const avui = centerDateStr(now);
  for (const utcHour of cronUtcHours) {
    const run = new Date(now);
    run.setUTCHours(utcHour, 0, 0, 0);
    // Ja ha passat, o és aquesta mateixa.
    if (run.getTime() <= now.getTime() + RUN_TOLERANCE_MS) continue;
    // Cau en un altre dia del centre: no serveix per als avisos d'avui.
    if (centerDateStr(run) !== avui) continue;
    if (centerHour(run) >= reminderHourLocal) return true;
  }
  return false;
}

/**
 * Toca enviar els avisos de cortesia en aquesta passada?
 *
 * Els avisos OBLIGATORIS i tot el que és estat del negoci (renovacions,
 * caducitats, bons impagats) no passen per aquí: aquells corren el dia que
 * toca, corri el cron a l'hora que corri.
 */
export function toucaEnviarAvisos(
  now: Date,
  reminderHourLocal: number,
  cronUtcHours: number[] = CRON_UTC_HOURS,
): boolean {
  if (centerHour(now) >= reminderHourLocal) return true;
  return !hiHaPassadaMillorAvui(now, reminderHourLocal, cronUtcHours);
}
