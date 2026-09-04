import Link from "next/link";
import { SERVICE_LABELS } from "@/lib/labels";
import type { LowBono } from "@/lib/data/dashboard";
import { TAP } from "@/lib/utils";

/**
 * Targeta "Bons a punt d'esgotar-se" amb la llista clicable.
 *
 * No és una targeta de KPI perquè no és un número i prou: la llista pot créixer i cada
 * línia porta a una fitxa diferent. La comparteixen l'admin i el professional,
 * que veuen el mateix criteri sobre conjunts de bons diferents; l'únic que
 * canvia és a quina àrea porta l'enllaç, i per això va per paràmetre.
 */
export function LowBonosCard({
  bonos,
  clientHrefBase,
  className = "",
}: {
  bonos: LowBono[];
  /** Prefix de la fitxa del client: "/admin/clients" o "/trainer/clients". */
  clientHrefBase: string;
  className?: string;
}) {
  const warn = bonos.length > 0;
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 ${
        warn
          ? "border-brand-orange/40 bg-brand-orange/5"
          : "border-brand-border bg-white"
      } ${className}`}
    >
      <div
        className={`text-xs font-bold tracking-wide uppercase ${
          warn ? "text-brand-orange" : "text-brand-muted"
        }`}
      >
        Bons a punt d&apos;esgotar-se
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          warn ? "text-brand-orange" : "text-brand-purple"
        }`}
      >
        {bonos.length}
      </div>
      {bonos.length === 0 ? (
        <p className="mt-1 text-xs text-brand-muted">
          Cap bo per sota del llindar configurat.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-brand-orange/20">
          {bonos.map((b) => (
            <li key={b.bonoId}>
              <Link
                href={`${clientHrefBase}/${b.clientId}`}
                className={`flex items-baseline justify-between gap-2 py-1.5 text-xs hover:underline ${TAP}`}
              >
                <span className="truncate">
                  <span className="font-bold text-brand-dark">
                    {b.clientName}
                  </span>{" "}
                  <span className="text-brand-muted">
                    {SERVICE_LABELS[b.serviceType]}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-brand-orange">
                  {b.remaining === 1 ? "1 sessió" : `${b.remaining} sessions`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
