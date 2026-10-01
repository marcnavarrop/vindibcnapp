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
 *
 * DOS NIVELLS (des del «sostre de 1000»):
 *
 *   · «s'hi acosta»: una resposta de 500 files o més (`SUPABASE_ROWS_WARN`).
 *     Les llistes que creixen amb el centre ja van per pàgines de 50; les que
 *     no (vals, referits, suport, enquestes, anuncis, liquidacions, bonus,
 *     subscripcions…) estan anotades a `scripts/row-limit-check.mjs` com a
 *     pendents. Aquest avís és el senyal per passar-les a pàgines abans que
 *     arribin al sostre.
 *   · «retallada»: la resposta porta tantes files com el sostre, i n'hi pot
 *     haver més que no han arribat.
 */

const DEFAULT_MAX_ROWS = 1000;
const DEFAULT_WARN_ROWS = 500;

export function maxRows(): number {
  const n = Number.parseInt(process.env.SUPABASE_MAX_ROWS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ROWS;
}

/** A partir de quantes files una resposta «s'hi acosta». Mai per sobre del sostre. */
export function warnRows(): number {
  const n = Number.parseInt(process.env.SUPABASE_ROWS_WARN ?? "", 10);
  const v = Number.isFinite(n) && n > 0 ? n : DEFAULT_WARN_ROWS;
  return Math.min(v, maxRows());
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
    // Una lectura per pàgines a propòsit (`fetchAllRows`, `.range()`) porta
    // `offset`: les pàgines plenes no estan retallades, i n'hi ha més darrere.
    const paged = /[?&]offset=\d/.test(urlOf(input));
    if (!paged && rows !== null && rows >= maxRows()) {
      console.warn(
        `[supabase] resposta retallada al sostre de ${maxRows()} files: ${tableOf(urlOf(input)) ?? "?"}`,
      );
    } else if (!paged && rows !== null && rows >= warnRows()) {
      console.warn(
        `[supabase] resposta de ${rows} files, s'acosta al sostre de ${maxRows()}: ${tableOf(urlOf(input)) ?? "?"} (cal passar-la a pàgines)`,
      );
    }
  } catch {
    // Mirar és opcional; la resposta no.
  }
  return res;
};
