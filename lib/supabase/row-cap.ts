/**
 * Avís quan una resposta de la base arriba al sostre de files.
 *
 * Supabase talla cada lectura a "Max rows" (1000 per defecte, a Settings →
 * API) i NO ho diu: torna 1000 files i prou, i la pantalla les pinta com si
 * fossin totes. Aquí es mira la capçalera `Content-Range` de cada resposta
 * ("0-999/*": de la fila 0 a la 999) i, si en porta tantes com el sostre, es
 * deixa un avís als logs.
 *
 * Al log hi va NOMÉS el nom de la taula (o de la funció `rpc/...`), mai la URL
 * sencera: els filtres hi porten correus, telèfons i ids.
 *
 * El sostre es llegeix de `SUPABASE_MAX_ROWS` perquè ha de coincidir amb el
 * del projecte. Si algun dia s'hi canvia, s'ha de canviar tots dos llocs.
 */

const DEFAULT_MAX_ROWS = 1000;

export function maxRows(): number {
  const n = Number.parseInt(process.env.SUPABASE_MAX_ROWS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ROWS;
}

/** "reservations", "rpc/cancel_reservation"… o null si no és una crida REST. */
export function tableOf(url: string): string | null {
  try {
    const m = /\/rest\/v1\/(.+)$/.exec(new URL(url).pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Quantes files diu la capçalera que porta la resposta, o null si no ho diu. */
export function rowsInRange(contentRange: string | null): number | null {
  const m = /^(\d+)-(\d+)\//.exec(contentRange ?? "");
  return m ? Number(m[2]) - Number(m[1]) + 1 : null;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * El `fetch` que fan servir els clients de Supabase del servidor. Fa la
 * petició igual que sempre i, després, només mira; si mirar falla, no passa
 * res: l'avís mai no pot trencar una consulta.
 */
export const rowCapFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  try {
    const rows = rowsInRange(res.headers.get("content-range"));
    if (rows !== null && rows >= maxRows()) {
      console.warn(
        `[supabase] resposta retallada al sostre de ${maxRows()} files: ${tableOf(urlOf(input)) ?? "?"}`,
      );
    }
  } catch {
    // Mirar és opcional; la resposta no.
  }
  return res;
};
