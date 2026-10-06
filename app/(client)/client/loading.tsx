import { SkeletonPage } from "@/components/ui/skeleton";

/**
 * Estat de càrrega per a tota l'àrea de client (i les rutes filles que no en
 * tinguin un de propi). Next l'usa com a frontera de Suspense: el menú lateral
 * ja es pinta mentre la pàgina resol les seves dades, en comptes d'esperar en
 * blanc fins a tenir-ho tot.
 */
export default function ClientLoading() {
  return <SkeletonPage />;
}
