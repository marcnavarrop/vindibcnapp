import { SkeletonPage } from "@/components/ui/skeleton";

/**
 * Estat de càrrega de tota l'àrea d'administració.
 *
 * Sense aquest fitxer, cada clic al menú deixava la pantalla anterior quieta
 * fins que el servidor acabava (de 0,2 a 1,2 s) i semblava que el clic no
 * havia funcionat. A més, el prefetch dels enllaços del menú tornava buit: no
 * hi havia res a precarregar. Amb la frontera, el prefetch porta aquest
 * esquelet i es pinta al moment.
 *
 * VA AQUÍ I NOMÉS AQUÍ, NO A CADA PANTALLA. La frontera es munta amb la clau
 * del segment fill (`clients`, `reservas`…), que no canvia en moure's dins
 * d'una mateixa pantalla. Un `loading.tsx` dins de `reservas/` tindria per clau
 * la pàgina amb els seus paràmetres (`?dia=`, `?vista=`) i esborraria l'agenda
 * amb l'esquelet a cada canvi de dia; un dins de `clients/` faria perdre el
 * focus al cercador a cada lletra.
 */
export default function AdminLoading() {
  return <SkeletonPage />;
}
