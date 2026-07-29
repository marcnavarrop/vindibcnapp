import { Skeleton } from "@/components/ui/skeleton";

/**
 * El calendari té una forma prou diferent de la resta de pàgines com perquè el
 * skeleton genèric hi desentoni: aquí s'insinua la graella de setmana.
 */
export default function ReservasLoading() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      {/* Controls (setmana, filtres) */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Graella: capçalera de dies + files d'hores */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-brand-border bg-white">
        <div className="grid grid-cols-8 gap-px border-b border-brand-border bg-brand-border">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="bg-brand-bg p-2">
              <Skeleton className="h-3.5 w-full" />
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} className="grid grid-cols-8 gap-px bg-brand-border">
            {Array.from({ length: 8 }, (_, col) => (
              <div key={col} className="bg-white p-2">
                <Skeleton className="h-8 w-full opacity-60" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
