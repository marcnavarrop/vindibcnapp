/**
 * Llegir SENCERA una consulta que pot passar del sostre de 1000 files.
 *
 * Supabase talla cada resposta a 1000 files (Settings → API → Max rows) i no
 * ho diu. Per a les lectures que han de ser completes —l'ocupació d'una
 * finestra de dies, els destinataris d'un correu— no n'hi ha prou amb una
 * consulta: es demana per pàgines amb `.range()` fins que una torna incompleta.
 *
 * Qui crida ha de:
 *   · acotar la consulta (una finestra de dates, un filtre): això no és per
 *     portar taules senceres;
 *   · ordenar-la de manera ESTABLE i única (p. ex. per hora i per id). Sense un
 *     ordre total, dues pàgines podrien repetir o saltar files.
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     admin.from("reservations").select("…").gte(…).lt(…)
 *       .order("scheduled_at").order("id").range(from, to),
 *   );
 *
 * Les peticions amb `limit`/`offset` no disparen l'avís del sostre
 * (`row-cap.ts`): ja van per pàgines a propòsit.
 */

import { maxRows } from "@/lib/supabase/row-cap";

/** Tall de seguretat: més pàgines que això és que la consulta no està acotada. */
const MAX_PAGES = 50;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  /**
   * Ha de ser EL SOSTRE del projecte (`SUPABASE_MAX_ROWS`): una pàgina més
   * curta que això vol dir «no n'hi ha més». Si fos més gran que el sostre, la
   * base tornaria menys files i el bucle pararia abans d'hora.
   */
  pageSize: number = maxRows(),
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
  throw new Error(
    `fetchAllRows: més de ${MAX_PAGES * pageSize} files. La consulta no està prou acotada.`,
  );
}
