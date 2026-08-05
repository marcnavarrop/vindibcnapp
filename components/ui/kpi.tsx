import Link from "next/link";

/**
 * Targeta KPI dels taulers (admin i professional).
 *
 * Viu aquí i no dins de cada pàgina perquè els dos taulers han de tenir el
 * mateix aspecte: si el to d'avís o l'espaiat canvia, ha de canviar als dos
 * alhora sense que ningú s'hagi de recordar del segon.
 *
 * `tone` "warn" per a les que demanen una acció de qui la mira.
 */
export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  children,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "neutral" | "warn";
  href?: string;
  children?: React.ReactNode;
}) {
  const warn = tone === "warn";
  const body = (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 transition-colors ${
        warn
          ? "border-brand-orange/40 bg-brand-orange/5 hover:border-brand-orange"
          : "border-brand-border bg-white hover:border-brand-purple"
      }`}
    >
      <div
        className={`text-xs font-bold tracking-wide uppercase ${
          warn ? "text-brand-orange" : "text-brand-muted"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          warn ? "text-brand-orange" : "text-brand-purple"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-brand-muted">{hint}</div>}
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Percentatge amb un sol decimal, com el mostren els dos taulers. */
export function pct1(n: number): string {
  return n.toLocaleString("ca-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
