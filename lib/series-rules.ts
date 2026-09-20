/**
 * Quines reserves es poden repetir en bucle.
 *
 * VIU AQUÍ I NO A `lib/data/reservations.ts` PERQUÈ LA NECESSITEN LES DUES BANDES
 *
 * La fan servir les dues portes del client (la casella «Fer-ho recurrent» i el
 * botó «Repetir en bucle a partir d'aquesta»), el camp «Repeticions setmanals»
 * del formulari d'admin i professional, i les accions de l'assistent al
 * servidor. Una sola funció perquè les quatre diguin sempre el mateix: amb una
 * còpia a cada banda, una pantalla oferiria una cosa que el servidor rebutja.
 *
 * LA REGLA, I EL SEU MOTIU DE VERITAT: L'AFORAMENT
 *
 * Una reserva de grup no es pot repetir en bucle. Un grup són quatre places, i
 * una sèrie marcada per allargar-se sola deixaria la mateixa franja de quatre
 * places ocupada indefinidament per la mateixa persona. El centre no pot
 * planificar amb això.
 *
 * AIXÒ NO TÉ RES A VEURE AMB COM ES PAGA, I CAL DIR-HO EN VEU ALTA
 *
 * Fins a la 0086 aquesta funció era literalment `!isSubscriptionOnly(tipus)`, i
 * semblava que les sèries es prohibien perquè el grup anava per subscripció.
 * Era una coincidència: hi havia un sol tipus subscribible i era el de grup, o
 * sigui que les dues condicions donaven sempre el mateix.
 *
 * En separar-se, la coincidència es trenca i copiar-la deixaria forats en les
 * DUES direccions:
 *
 *   · 'Bo de 6 sessions' és de grup i NO va per subscripció. Si la regla mirés
 *     la casella, diria que sí es pot repetir, i una sèrie eterna damunt d'ell
 *     bloquejaria una de les quatre places per sempre. És el forat exacte que
 *     aquesta regla existeix per tapar.
 *   · Un 'ep_individual' marcat com a subscripció diria que NO es pot repetir,
 *     prohibint repetir sessions individuals sense que hi hagi cap aforament
 *     que protegir.
 *
 * Per això la regla de compra (`lib/subscription-rules.ts`) mira el PAQUET i
 * aquesta mira el TIPUS DE SERVEI. No són la mateixa idea i no comparteixen
 * fitxer.
 *
 * HI HA, A MÉS, UN MOTIU D'ESQUEMA QUE HO FA OBLIGATORI
 *
 * `bonos` i `reservations` guarden `service_type` i NO `service_id` (0001, i la
 * 0069 ja ho va deixar escrit). Un cop venut un bo, de quin paquet va sortir no
 * consta enlloc i no es pot reconstruir per als que ja hi ha. La regla de
 * compra pot mirar el paquet perquè encara el té al davant —s'està triant—; la
 * de sèries no el tindrà mai. Que el disseny correcte i el que l'esquema permet
 * apuntin al mateix lloc és una bona senyal, no una excusa.
 */
import type { ServiceType } from "@/types/database";

/** El servei l'aforament del qual no aguanta sèries. */
const CAPACITY_LIMITED_SERVICE: ServiceType = "grupo_reducido";

/** Aquesta reserva es pot repetir en bucle? */
export function canRepeatInSeries(
  serviceType: ServiceType | null | undefined,
): boolean {
  return serviceType !== CAPACITY_LIMITED_SERVICE;
}
