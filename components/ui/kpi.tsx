/** Percentatge amb un sol decimal, com el mostren els dos taulers. */
export function pct1(n: number): string {
  return n.toLocaleString("ca-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
