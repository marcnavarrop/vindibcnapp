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
