/**
 * Quins paquets només es poden tenir per subscripció.
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
 * Un paquet marcat com a «només per subscripció» NO es pot comprar solt: ni
 * pagant al centre, ni amb targeta d'un sol cop, ni donant-lo d'alta a mà des de
 * la fitxa d'un client, ni regalant-lo en un val. L'única porta és la
 * subscripció mensual, que el client pot pagar al centre o amb targeta, i que
 * l'administració i el professorat poden donar d'alta al centre en nom seu.
 *
 * VA PER PAQUET I NO PER TIPUS DE SERVEI (0086)
 *
 * Fins al setembre del 2026 això era una constant clavada a 'grupo_reducido', i
 * va durar quatre dies. El 14 de setembre es van donar d'alta dos paquets de
 * grup que NO són mensualitats —'Sessió individual' i 'Bo de 6 sessions'— i el
 * 18 la regla els va deixar invendibles sense que ningú ho decidís. El catàleg
 * ja distingia les dues idees en el nom; el codi no ho veia.
 *
 * Ara ho diu una casella de cada fila de `services`, que l'administració marca
 * des de Catàleg → Serveis. Dins d'un mateix tipus hi poden conviure els dos
 * règims, que és exactament el cas del grup reduït.
 *
 * PER QUÈ REP L'OBJECTE I NO UN `ServiceType`
 *
 * Perquè la resposta ja no es pot deduir del tipus: fa falta la fila. Rebre el
 * paquet obliga qui crida a tenir-lo carregat, i això és el que volem —si algun
 * punt de compra no el té a mà, el compilador ho diu en comptes de deixar-lo
 * endevinar pel tipus—. Accepta les dues formes del mateix camp perquè hi ha
 * camins que treballen amb la fila crua de Supabase (`gift-vouchers`) i altres
 * amb el `Service` ja mapejat.
 *
 * EL QUE AQUESTA REGLA NO DIU
 *
 * No diu res de l'aforament ni de si les reserves d'aquest paquet es poden
 * repetir en sèrie. Això és `lib/series-rules.ts`, i el motiu que les separa hi
 * està explicat. Fins a la 0086 les dues coses coincidien per casualitat —hi
 * havia un sol tipus subscribible—, i confondre-les ara deixaria forats en les
 * dues direccions.
 */

/**
 * El mínim que cal saber d'un paquet per decidir si es ven solt.
 *
 * Estructural i no `Service` sencer: així serveix igual per a la fila crua de
 * la base (`subscription_only`) i per al paquet ja mapejat
 * (`subscriptionOnly`), sense obligar cap camí a convertir res només per
 * preguntar-ho.
 */
export type SubscriptionFlag =
  | { subscriptionOnly: boolean }
  | { subscription_only: boolean };

/** Aquest paquet només es pot tenir per subscripció? */
export function isSubscriptionOnly(
  pkg: SubscriptionFlag | null | undefined,
): boolean {
  if (!pkg) return false;
  return "subscriptionOnly" in pkg
    ? pkg.subscriptionOnly === true
    : pkg.subscription_only === true;
}
