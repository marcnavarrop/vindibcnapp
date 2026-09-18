/**
 * El bo de grup només existeix per subscripció.
 *
 * VIU AQUÍ I NO A `lib/data/subscriptions.ts` PERQUÈ LA NECESSITEN LES DUES BANDES
 *
 * La pantalla l'ha de saber per decidir què ofereix, i el servidor per
 * comprovar-ho abans d'escriure. `lib/data/subscriptions.ts` comença amb
 * `server-only` —hi ha la clau de servei a tocar—, així que cap component amb
 * `"use client"` no en pot importar res. Mateix criteri i mateix motiu que
 * `lib/bono-rules.ts`. Amb una còpia a cada banda, el dia que la regla canviï
 * una pantalla oferiria una cosa que el servidor rebutja.
 *
 * LA REGLA
 *
 * Un bo de 'grupo_reducido' NO es pot comprar solt: ni pagant al centre, ni amb
 * targeta d'un sol cop, ni donant-lo d'alta a mà des de la fitxa d'un client, ni
 * regalant-lo en un val. L'única porta és la subscripció mensual, que el client
 * pot pagar al centre o amb targeta, i que l'administració i el professorat
 * poden donar d'alta al centre en nom seu.
 *
 * El motiu és l'aforament. Un grup són quatre places, i una compra solta les
 * ocupa sense cap compromís de continuïtat: el centre no pot planificar amb això.
 * La subscripció és el que fa que una plaça de grup tingui amo cada mes.
 *
 * LA SEGONA MEITAT DE LA REGLA: LES SÈRIES
 *
 * Una reserva de grup tampoc es pot repetir en bucle. El risc és el mateix
 * aforament vist des de l'altre costat: una sèrie marcada per allargar-se sola,
 * damunt d'una subscripció que es renova cada mes, deixaria la mateixa franja
 * de quatre places ocupada indefinidament per la mateixa persona.
 *
 * CONSEQÜÈNCIA QUE CAL DIR EN VEU ALTA: AIXÒ RETIRA LA 0074
 *
 * L'extensió automàtica de sèries (0074) exigeix una subscripció viva del
 * mateix servei, i les subscripcions només existeixen per a 'grupo_reducido'
 * (ho diu `SUBSCRIBABLE_SERVICE_TYPE` i ho garanteix un check de la 0072). Si
 * cap sèrie nova pot ser de grup, CAP SÈRIE NOVA PODRÀ AUTO-ALLARGAR-SE MAI.
 *
 * La maquinària de la 0074 es queda igualment en peu, i no és nostàlgia: hi ha
 * sèries de grup creades abans d'aquesta regla que encara tenen ocurrències
 * reservades, i s'han de poder cancel·lar, comptar i servir com sempre. El que
 * s'atura és que en generin de NOVES —vegeu `extendSeriesForSubscription`—; el
 * que ja està reservat es respecta i s'esgota sol.
 */
import type { ServiceType } from "@/types/database";

/** L'únic servei que no es pot comprar solt. */
export const SUBSCRIPTION_ONLY_SERVICE: ServiceType = "grupo_reducido";

/** Aquest servei només es pot tenir per subscripció? */
export function isSubscriptionOnly(
  serviceType: ServiceType | null | undefined,
): boolean {
  return serviceType === SUBSCRIPTION_ONLY_SERVICE;
}

/**
 * Aquesta reserva es pot repetir en bucle?
 *
 * La fan servir les dues portes del client (la casella «Fer-ho recurrent» i el
 * botó «Repetir en bucle a partir d'aquesta»), el camp «Repeticions setmanals»
 * del formulari d'admin i professional, i les accions de l'assistent al
 * servidor. Una sola funció perquè les quatre diguin sempre el mateix.
 */
export function canRepeatInSeries(
  serviceType: ServiceType | null | undefined,
): boolean {
  return !isSubscriptionOnly(serviceType);
}
