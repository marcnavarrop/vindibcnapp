/**
 * Traspàs d'identitat del middleware al render.
 *
 * El middleware ja valida la sessió (auth.getUser) i llegeix el rol de
 * `profiles` a cada petició. Sense això, `getViewer()` ho repetia tot al
 * render: quatre viatges de xarxa per càrrega, dos d'ells duplicats.
 *
 * ─── CONTRACTE DE SEGURETAT ───
 * Aquestes capçaleres són de confiança perquè es compleixen TRES coses. Les
 * dues primeres són procedimentals i la tercera és criptogràfica; hi són totes
 * perquè les dues primeres ja van fallar una vegada.
 *
 *  1. El middleware les ESBORRA totes al principi de cada petició que gestiona
 *     (stripViewerHeaders), abans de decidir res. Així, si algú les envia des
 *     de fora, mai arriben al render.
 *
 *  2. El `matcher` del middleware cobreix TOTES les rutes. Des que és NEGATIU
 *     —tot menys els fitxers estàtics— afegir una ruta nova ja no pot deixar-la
 *     fora per descuit: el descuit ara falla cap al costat segur.
 *
 *     Abans era una llista positiva i això va ser exactament el forat: una
 *     Server Action (`setLocaleAction`) muntada a /login, /register i /prova
 *     cridava `getViewer()` en rutes que el matcher no cobria, i una petició
 *     SENSE cap galeta podia dir qui era. Es va reproduir de punta a punta.
 *
 *  3. Van SIGNADES. El middleware hi posa un HMAC (`x-vindi-user-sig`) i
 *     `getViewer()` el comprova abans de creure-se-les. Encara que un dia una
 *     ruta s'escapés del matcher, unes capçaleres inventades no passarien la
 *     comprovació: sense la clau del servidor no se'n pot fabricar la firma.
 *
 * Si mai falten —o la firma no quadra—, `getViewer()` fa el camí complet de
 * sempre: absència (o sospita) degrada a consultar Supabase, no a confiar.
 *
 * ─── D'ON SURT LA CLAU ───
 *
 * Es DERIVA de `SUPABASE_SERVICE_ROLE_KEY`, que ja hi és a tots dos costats i
 * sense la qual l'aplicació no funciona. A posta: una variable d'entorn NOVA
 * seria una peça que algú pot oblidar-se de posar a Vercel, i el símptoma
 * —tornar al camí lent en silenci— no el notaria ningú durant mesos.
 *
 * No es fa servir la clau tal qual sinó un SHA-256 amb un prefix de propòsit,
 * que és el que separa aquest ús de qualsevol altre que la clau tingui.
 *
 * Aquest mòdul l'importa el middleware (Edge): sense dependències de Node ni
 * "server-only". `crypto.subtle` és Web Crypto i hi és als dos entorns.
 */

export const VIEWER_HEADERS = {
  id: "x-vindi-user-id",
  email: "x-vindi-user-email",
  name: "x-vindi-user-name",
  role: "x-vindi-user-role",
  specialty: "x-vindi-user-specialty",
  /** HMAC de les cinc anteriors. Sense ella, cap no val. */
  sig: "x-vindi-user-sig",
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

// ─── Firma ──────────────────────────────────────────────────────────────────

/**
 * Els valors que entren a la firma, sempre en aquest ordre i amb cadena buida
 * per als que falten. L'ordre és part del contracte: si canvia, les firmes
 * velles deixen de valer (i el pitjor que passa és tornar al camí complet).
 */
export type ViewerClaims = {
  id: string;
  role: string;
  email: string;
  name: string;
  specialty: string;
};

/**
 * Cadena canònica. Els valors ja venen codificats amb `encodeHeaderValue` o
 * són identificadors sense espais, així que cap pot contenir un salt de línia
 * i el separador no és ambigu.
 */
function canonical(c: ViewerClaims): string {
  return [c.id, c.role, c.email, c.name, c.specialty].join("\n");
}

let cachedKey: Promise<CryptoKey> | null = null;

/** La clau d'HMAC, derivada un sol cop per procés. */
function hmacKey(secret: string): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = (async () => {
      const enc = new TextEncoder();
      // Prefix de propòsit: separa aquest ús de qualsevol altre de la clau.
      const material = await crypto.subtle.digest(
        "SHA-256",
        enc.encode(`vindi:viewer-headers:v1:${secret}`),
      );
      return crypto.subtle.importKey(
        "raw",
        material,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
    })();
  }
  return cachedKey;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signa les afirmacions. Retorna null si no hi ha clau: aleshores el middleware
 * NO posa cap capçalera i el render fa el camí complet, que és correcte encara
 * que sigui més lent.
 */
export async function signViewerClaims(
  c: ViewerClaims,
): Promise<string | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonical(c)),
  );
  return toHex(mac);
}

/** Comparació en temps constant: no filtra per on difereixen dues firmes. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Comprova la firma. Fals vol dir "no te'n refiïs": qui crida ha de fer el
 * camí complet, mai endevinar.
 */
export async function verifyViewerClaims(
  c: ViewerClaims,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await signViewerClaims(c);
  return expected !== null && constantTimeEqual(expected, signature);
}
