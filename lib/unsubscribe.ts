import "server-only";
import crypto from "node:crypto";
import { USE_MOCK } from "@/lib/config";
import { appLink } from "@/lib/notifications/brand";

/**
 * L'ENLLAÇ PER DEIXAR DE REBRE LES NOVETATS DE LA COMUNITAT (art. 21.2 LSSI).
 *
 * Funciona SENSE iniciar sessió: porta l'id del perfil i una signatura HMAC
 * amb `UNSUBSCRIBE_SECRET` (variable d'entorn de Vercel, només producció). No
 * es desa cap token: la signatura es torna a calcular i es compara.
 *
 * Sense el secret no hi ha enllaç signat (`null`): qui crida posa el de
 * Configuració → Notificacions, que demana sessió. En simulació se'n fa servir
 * un de fix perquè les proves tinguin enllaç.
 */
const SCOPE = "community";

function secret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || (USE_MOCK ? "mock-unsubscribe-secret" : null);
}

function sign(profileId: string, key: string): string {
  return crypto.createHmac("sha256", key).update(`${SCOPE}:${profileId}`).digest("base64url").slice(0, 32);
}

const UUIDISH = /^[0-9a-zA-Z-]{1,64}$/;

/** La signatura és bona per a aquest perfil? En temps constant. */
export function verifyUnsubscribe(profileId: string | null | undefined, token: string | null | undefined): boolean {
  const key = secret();
  if (!key || !profileId || !token || !UUIDISH.test(profileId)) return false;
  const want = Buffer.from(sign(profileId, key));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

function query(profileId: string): string | null {
  const key = secret();
  if (!key) return null;
  return `p=${encodeURIComponent(profileId)}&t=${sign(profileId, key)}`;
}

/** La pàgina (amb botó de confirmar) per deixar de rebre-les. */
export function communityUnsubscribeUrl(profileId: string): string | null {
  const q = query(profileId);
  return q ? appLink(`/baixa/comunitat?${q}`) : null;
}

/** L'adreça d'un sol clic (`List-Unsubscribe-Post`, RFC 8058), per als clients de correu. */
export function communityUnsubscribeOneClickUrl(profileId: string): string | null {
  const q = query(profileId);
  return q ? appLink(`/api/unsubscribe/community?${q}`) : null;
}
