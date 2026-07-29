import {
  SkeletonPageHeader,
  SkeletonCard,
} from "@/components/ui/skeleton";

/**
 * Estat de càrrega per a tota l'àrea de client (i les rutes filles que no en
 * tinguin un de propi). Next l'usa com a frontera de Suspense: el menú lateral
 * ja es pinta mentre la pàgina resol les seves dades, en comptes d'esperar en
 * blanc fins a tenir-ho tot.
 */
export default function ClientLoading() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <SkeletonPageHeader />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
