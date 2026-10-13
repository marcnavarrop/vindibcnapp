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
/** Quantes línies es veuen a l'inici; la resta, a un toc. */
const SHOWN = 5;

export function LowBonosCard({
  bonos,
  clientHrefBase,
  allHref,
  className = "",
}: {
  bonos: LowBono[];
  /** Prefix de la fitxa del client: "/admin/clients" o "/trainer/clients". */
  clientHrefBase: string;
  /** On es veuen tots els bons ("/admin/bonos" o "/trainer/bonos"). */
  allHref: string;
  className?: string;
}) {
  const warn = bonos.length > 0;
  // Bons i clients no són el mateix: un client amb un bo d'entrenament i un
  // de fisio baixos en surt dos cops. Abans es deia «19 clients» comptant bons.
  const clients = new Set(bonos.map((b) => b.clientId)).size;
  const shown = bonos.slice(0, SHOWN);
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 ${
        warn
          ? "border-attention/25 bg-attention-bg [&_.text-brand-muted]:text-brand-tab"
          : "border-brand-border bg-white"
      } ${className}`}
    >
      <div
        className={`text-xs font-bold tracking-wide uppercase ${
          warn ? "text-attention" : "text-brand-muted"
        }`}
      >
        Bons a punt d&apos;esgotar-se
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          warn ? "text-attention" : "text-brand-purple"
        }`}
      >
        {bonos.length}
      </div>
      {warn && (
        <p className="text-xs text-brand-muted">
          {clients === 1 ? "D'1 client" : `De ${clients} clients`} a qui oferir renovació
        </p>
      )}
      {bonos.length === 0 ? (
        <p className="mt-1 text-xs text-brand-muted">
          Cap bo per sota del llindar configurat.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-attention/15">
          {shown.map((b) => (
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
                <span className="shrink-0 font-bold text-attention">
                  {b.remaining === 1 ? "1 sessió" : `${b.remaining} sessions`}
                </span>
              </Link>
            </li>
          ))}
          {bonos.length > SHOWN && (
            <li>
              {/* La resta no es pinta a l'inici: amb 19, la llista feia més
                  d'una pantalla al mòbil. */}
              <Link
                href={allHref}
                className={`block py-2 text-xs font-bold text-brand-purple hover:underline ${TAP}`}
              >
                I {bonos.length - SHOWN} més · veure tots els bons →
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
