/** Percentatge amb un sol decimal, com el mostren els dos taulers. */
export function pct1(n: number): string {
  return n.toLocaleString("ca-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** El que ensenya una targeta que no s'ha pogut carregar: un guionet, mai un zero. */
export const KPI_FAILED_VALUE = "—";
export const KPI_FAILED_HINT = "No s'ha pogut carregar";

/**
 * Avís damunt de les targetes quan n'ha fallat alguna. Les xifres que sí que
 * s'han carregat es queden; les altres porten el guionet i ho diuen.
 */
export function KpiFailedNotice({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p
      role="alert"
      className="col-span-full rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
    >
      {count === 1
        ? "Una de les xifres no s'ha pogut carregar."
        : "Algunes xifres no s'han pogut carregar."}{" "}
      No són zeros: torna a carregar la pàgina d&apos;aquí a una estona.
    </p>
  );
}
