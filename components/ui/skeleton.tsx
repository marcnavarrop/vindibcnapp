import { clsx } from "@/lib/utils";

/**
 * Bloc de càrrega. Només és una forma grisa que batega: no mostra cap dada,
 * serveix perquè la pantalla no es quedi en blanc mentre arriben.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx("animate-pulse rounded-lg bg-brand-border", className)}
    />
  );
}

/**
 * Capçalera de pàgina (títol + subtítol), igual a la de les pàgines reals
 * perquè el salt en carregar sigui mínim.
 */
export function SkeletonPageHeader() {
  return (
    <>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
    </>
  );
}

/** Targeta genèrica amb unes quantes línies. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-5">
      <Skeleton className="h-5 w-1/2" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="mt-2 h-3.5 w-full" />
      ))}
    </div>
  );
}

/**
 * La pàgina genèrica en càrrega: capçalera i quatre targetes. És el
 * `loading.tsx` de les tres àrees (client, professional i admin), perquè canviar
 * de pantalla es vegi igual a totes.
 */
export function SkeletonPage() {
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
