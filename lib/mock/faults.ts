import { USE_MOCK } from "@/lib/config";

/**
 * Errors de consulta simulats, NOMÉS en mode demo.
 *
 * La base de veritat pot fallar i el mode demo no, i el que cal provar és
 * justament què ensenya la pantalla quan falla: un error dit, no uns zeros que
 * semblen certs. Amb `MOCK_FAIL=payments,notes` (llista separada per comes)
 * aquelles lectures del mode demo fan com si la base hagués tornat un error.
 *
 * Fora del mode demo no fa res, encara que la variable hi sigui.
 */
export function mockFails(part: string): boolean {
  if (!USE_MOCK) return false;
  const list = (process.env.MOCK_FAIL ?? "").split(",").map((s) => s.trim());
  return list.includes(part);
}
