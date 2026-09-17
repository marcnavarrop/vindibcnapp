import "server-only";
import { cookies } from "next/headers";
import type { UserRole } from "@/types/database";

/**
 * Mode PRE: saltar entre els comptes de demostració sense tornar a entrar.
 *
 * QUÈ RESOL
 *
 * Provar l'app com els tres rols volia dir tancar sessió i tornar a entrar amb
 * unes altres credencials, tres vegades. Amb el mode PRE armat, l'admin salta
 * d'un compte demo a un altre amb un clic i torna al seu amb un altre.
 *
 * ─── PER QUÈ UNA SESSIÓ DE VERITAT I NO UN "VEURE COM SI FOS" ───
 *
 * Aquesta app passa la identitat del middleware al render en capçaleres
 * SIGNADES (lib/auth-headers.ts), i `getViewer()` no se les creu si la firma no
 * quadra. Un "veure com si fos" hauria de fabricar aquestes afirmacions, que és
 * exactament el forat que aquest projecte ja ha tapat dues vegades. Així que el
 * salt obre una sessió REAL cap al compte demo: `generateLink` per treure el
 * token sense enviar cap correu i `verifyOtp` al servidor per deixar-lo escrit
 * a les galetes. El token no surt mai del servidor.
 *
 * ─── EL CAMÍ DE TORNADA ───
 *
 * Abans de saltar es desa el `refresh_token` de l'admin en una galeta
 * ENCRIPTADA i httpOnly, i en tornar es refresca aquella mateixa sessió. Es
 * RESTAURA una credencial que ja existia; no se'n fabrica cap de nova.
 *
 * Que això no és una exposició nova es pot comprovar: `@supabase/ssr` escriu
 * les galetes de sessió amb `httpOnly: false` (és el seu
 * DEFAULT_COOKIE_OPTIONS, i ha de ser així perquè el client del navegador les
 * pugui llegir). O sigui que el refresh token de l'admin JA és llegible pel JS
 * de la pàgina avui. Una còpia en una galeta httpOnly i xifrada està
 * estrictament menys exposada que on ja viu.
 *
 * ─── LA LLISTA BLANCA ÉS CODI, NO DADES ───
 *
 * `DEMO_ACCOUNTS` és una constant d'aquest fitxer i no una columna
 * `profiles.is_demo`. Una llista blanca a la base la pot canviar qualsevol cosa
 * amb permís d'escriptura; la regla "mai un compte real" es mereix ser una
 * constant que es vegi al git. Els tres correus no són cap secret.
 */

export type DemoSlug = "entrenador" | "fisio" | "client";

export type DemoAccount = {
  slug: DemoSlug;
  /** UUID a `auth.users` i a `profiles`. Es comprova després de resoldre. */
  id: string;
  email: string;
  label: string;
  /** Mai "admin". El tipus ja ho impedeix; el servidor ho torna a mirar. */
  role: Exclude<UserRole, "admin">;
  home: string;
};

/**
 * Els TRES comptes de demostració, i cap més.
 *
 * NO hi és `vindibcn@gmail.com` ("Admin Demo"), que és el compte REAL de
 * l'administrador d'en Raul: només té aquest nom de perfil. Que dugui "Demo" al
 * nom no el fa prescindible, i a més és admin —el salt d'admin a admin no
 * serveix de res i és l'únic que podria escalar—. Si algun dia algú l'hi afegeix
 * per descuit, la comprovació de rol de `resolveDemoTarget` el rebutja.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    slug: "entrenador",
    id: "5119e112-74af-4c85-862b-829f6d726ea2",
    email: "demo.entrenador@vindibcn.com",
    label: "Entrenador Demo",
    role: "trainer",
    home: "/trainer",
  },
  {
    slug: "fisio",
    id: "1c36928b-0668-4377-a5d8-c7befb2d78bc",
    email: "demo.fisio@vindibcn.com",
    label: "Fisio Demo",
    role: "trainer",
    home: "/trainer",
  },
  {
    slug: "client",
    id: "d3b42dcb-7c11-4431-abc0-723b21add106",
    email: "demo.client@vindibcn.com",
    label: "Client Demo",
    role: "client",
    home: "/client",
  },
] as const;

/**
 * Del que arriba del navegador NOMÉS s'accepta un dels tres noms curts, i el
 * servidor en treu el correu i l'id. El navegador no diu mai cap a qui es salta:
 * diu quin dels tres botons ha premut.
 */
export function demoBySlug(slug: unknown): DemoAccount | null {
  if (typeof slug !== "string") return null;
  return DEMO_ACCOUNTS.find((d) => d.slug === slug) ?? null;
}

export function demoById(id: string | null | undefined): DemoAccount | null {
  if (!id) return null;
  return DEMO_ACCOUNTS.find((d) => d.id === id) ?? null;
}

// ─── Galetes ────────────────────────────────────────────────────────────────

/** El mode PRE està armat en aquest navegador. */
const PRE_COOKIE = "vindi_pre";
/** Bitllet de tornada: hi ha un salt obert i aquesta és la sessió a restaurar. */
const BACK_COOKIE = "vindi_pre_back";

/** Vuit hores d'estar armat. Passades, es desarma sol. */
export const PRE_TTL_SECONDS = 8 * 60 * 60;
/** Dues hores per tornar. Un salt no s'ha de poder quedar obert tota la nit. */
export const BACK_TTL_SECONDS = 2 * 60 * 60;

const COOKIE_BASE = {
  path: "/",
  // httpOnly de veritat: el JS de la pàgina no ha de poder ni llegir-les ni
  // escriure-les. És el que separa aquestes galetes de les de sessió.
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

type PreTicket = { adminId: string; adminName: string; exp: number };
type BackTicket = {
  adminId: string;
  adminName: string;
  refreshToken: string;
  exp: number;
};

/**
 * La clau de xifrat. Es DERIVA de `SUPABASE_SERVICE_ROLE_KEY`, igual que la de
 * les capçaleres d'identitat, i pel mateix motiu: una variable d'entorn nova
 * seria una peça que algú es pot descuidar a Vercel.
 *
 * El PREFIX DE PROPÒSIT és diferent del de lib/auth-headers.ts a posta: són dos
 * usos de la mateixa clau mestra i no s'han de poder confondre mai.
 */
const PURPOSE = "vindi:pre-mode:v1:";

let cachedKey: Promise<CryptoKey | null> | null = null;

function sealKey(): Promise<CryptoKey | null> {
  if (!cachedKey) {
    cachedKey = (async () => {
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) return null;
      const material = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${PURPOSE}${secret}`),
      );
      return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
      ]);
    })();
  }
  return cachedKey;
}

/**
 * AES-GCM i no una simple firma: el bitllet de tornada duu un refresh token a
 * dins, i les galetes httpOnly es veuen igualment al panell d'aplicació del
 * navegador. Xifrat, allà només hi ha soroll. De passada, el GCM ja porta la
 * integritat inclosa, o sigui que no calen dues passades.
 */
async function seal(payload: unknown): Promise<string | null> {
  const key = await sealKey();
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return Buffer.from(out).toString("base64url");
}

async function unseal<T>(value: string | undefined): Promise<T | null> {
  if (!value) return null;
  const key = await sealKey();
  if (!key) return null;
  try {
    const raw = new Uint8Array(Buffer.from(value, "base64url"));
    if (raw.length <= 12) return null;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.subarray(0, 12) },
      key,
      raw.subarray(12),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    // Galeta manipulada, xifrada amb una altra clau o corrupta: no existeix.
    return null;
  }
}

/**
 * La caducitat la mana el CONTINGUT, no el `maxAge`.
 *
 * El `maxAge` és una instrucció al navegador i el navegador és de l'altre
 * costat. L'`exp` va dins del sobre xifrat, que no es pot tocar sense la clau.
 */
function alive<T extends { exp: number }>(ticket: T | null): T | null {
  if (!ticket) return null;
  return ticket.exp > Date.now() ? ticket : null;
}

export async function readPreTicket(): Promise<PreTicket | null> {
  const raw = (await cookies()).get(PRE_COOKIE)?.value;
  return alive(await unseal<PreTicket>(raw));
}

export async function readBackTicket(): Promise<BackTicket | null> {
  const raw = (await cookies()).get(BACK_COOKIE)?.value;
  return alive(await unseal<BackTicket>(raw));
}

export async function writePreTicket(input: {
  adminId: string;
  adminName: string;
}): Promise<boolean> {
  const value = await seal({
    ...input,
    exp: Date.now() + PRE_TTL_SECONDS * 1000,
  } satisfies PreTicket);
  if (!value) return false;
  (await cookies()).set(PRE_COOKIE, value, {
    ...COOKIE_BASE,
    maxAge: PRE_TTL_SECONDS,
  });
  return true;
}

export async function writeBackTicket(input: {
  adminId: string;
  adminName: string;
  refreshToken: string;
}): Promise<boolean> {
  const value = await seal({
    ...input,
    exp: Date.now() + BACK_TTL_SECONDS * 1000,
  } satisfies BackTicket);
  if (!value) return false;
  (await cookies()).set(BACK_COOKIE, value, {
    ...COOKIE_BASE,
    maxAge: BACK_TTL_SECONDS,
  });
  return true;
}

export async function clearPreTicket(): Promise<void> {
  (await cookies()).set(PRE_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}

export async function clearBackTicket(): Promise<void> {
  (await cookies()).set(BACK_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}

// ─── Estat per a la interfície ──────────────────────────────────────────────

export type PreState =
  | { mode: "off" }
  /** Armat, però encara ets tu. */
  | { mode: "armed"; adminName: string }
  /** Has saltat: estàs veient l'app com un dels demos. */
  | { mode: "acting"; adminName: string; demo: DemoAccount };

/**
 * Qui mira, i en quin dels tres estats. `viewerId` ve de `getViewer()`, que al
 * camí ràpid ja el té de les capçaleres firmades: això no costa cap consulta.
 */
export async function getPreState(
  viewerId: string | null | undefined,
): Promise<PreState> {
  const ticket = await readPreTicket();
  if (!ticket) return { mode: "off" };

  const back = await readBackTicket();
  if (back) {
    const demo = demoById(viewerId);
    // Amb bitllet de tornada, qui mira ha de ser un dels tres. Si no ho és
    // (galetes a mig camí, sessió canviada per fora), val més dir "armat" que
    // inventar-se un salt que no hi és.
    if (demo) return { mode: "acting", adminName: back.adminName, demo };
  }
  return { mode: "armed", adminName: ticket.adminName };
}

// ─── El fre de les dades personals ──────────────────────────────────────────

export const PRE_BLOCKED_MESSAGE =
  "Mode PRE actiu. L'exportació i la supressió de dades personals (RGPD) no " +
  "es fan en mode de proves. Apaga el mode PRE a Configuració i torna-ho a provar.";

/**
 * L'exportació i la supressió RGPD estan tancades mentre el mode PRE estigui
 * armat.
 *
 * NO ÉS PRUDÈNCIA GENÈRICA. `data_access_log` (migració 0015) és la PROVA de
 * compliment davant d'una reclamació: diu qui va exportar o esborrar les dades
 * de qui. Si això passa amb un salt obert, el registre apunta el compte demo
 * com a actor i la prova queda escrita malament. Val més exigir un gest
 * deliberat —apagar el mode de proves— abans de tocar dades personals.
 *
 * Es mira el bitllet PRE i no qui mira: en saltar a un demo no s'arriba ni a
 * /admin, o sigui que l'única finestra real és l'estat "armat".
 */
export async function preModeBlocksPersonalData(): Promise<boolean> {
  return (await readPreTicket()) !== null;
}
