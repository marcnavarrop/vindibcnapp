/**
 * Traspàs d'identitat del middleware al render.
 *
 * El middleware ja valida la sessió (auth.getUser) i llegeix el rol de
 * `profiles` a cada petició. Sense això, `getViewer()` ho repetia tot al
 * render: quatre viatges de xarxa per càrrega, dos d'ells duplicats.
 *
 * ─── CONTRACTE DE SEGURETAT ───
 * Aquestes capçaleres NOMÉS són de confiança perquè es compleixen dues coses,
 * i totes dues s'han de mantenir si es toca aquest codi:
 *
 *  1. El middleware les ESBORRA totes al principi de cada petició que gestiona
 *     (stripViewerHeaders), abans de decidir res. Així, si algú les envia des
 *     de fora, mai arriben al render.
 *  2. El `matcher` del middleware cobreix TOTES les rutes on es crida
 *     `getViewer()`. Si s'afegeix una ruta nova que el cridi i queda fora del
 *     matcher, allà el middleware no corre, ningú esborra les capçaleres i
 *     serien falsificables.
 *
 * Si mai falten, `getViewer()` fa el camí complet de sempre: absència de
 * capçalera degrada a consultar Supabase, no a confiar en res.
 *
 * Aquest mòdul l'importa el middleware (Edge): sense dependències ni
 * "server-only", perquè no engreixi el seu bundle.
 */

export const VIEWER_HEADERS = {
  id: "x-vindi-user-id",
  email: "x-vindi-user-email",
  name: "x-vindi-user-name",
  role: "x-vindi-user-role",
  specialty: "x-vindi-user-specialty",
} as const;

const ALL = Object.values(VIEWER_HEADERS);

/**
 * Esborra qualsevol valor entrant. S'ha de cridar SEMPRE, a totes les
 * branques, abans de decidir si l'usuari té sessió o no.
 */
export function stripViewerHeaders(headers: Headers): void {
  for (const name of ALL) headers.delete(name);
}

/**
 * Les capçaleres HTTP no admeten UTF-8: els noms amb accents es codifiquen.
 */
export function encodeHeaderValue(value: string): string {
  return encodeURIComponent(value);
}

export function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // Valor malmès: millor cadena buida que petar el render.
    return "";
  }
}
