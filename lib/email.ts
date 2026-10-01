import "server-only";
import { USE_MOCK } from "@/lib/config";

/**
 * Transport d'emails de baix nivell amb Resend. Configurable per entorn perquè
 * el dia que verifiquem el domini només calgui canviar variables, no codi:
 *
 *   RESEND_API_KEY          — clau de Resend (si no hi és, no s'envia res).
 *   NOTIFICATIONS_FROM_EMAIL — remitent, tal com l'espera Resend. Accepta tant
 *                              "email@domini" com el format "Nom <email@domini>"
 *                              (p. ex. "VindiBCN <hola@vindibcn.com>"); es passa
 *                              literalment, sense re-embolcallar. Per defecte, el
 *                              domini de proves de Resend (onboarding@resend.dev)
 *                              perquè no trenqui en local.
 *   CENTER_EMAIL            — (opcional) ÚLTIM recurs per als avisos interns, si
 *                              a Configuració → Centre no hi ha ni el correu
 *                              dels avisos ni el de contacte
 *                              (`internalNotifyEmail`).
 *   ALLOW_REAL_EMAILS       — "true" per deixar enviar de veritat des de fora
 *                              de producció. Sense ella, cap procés que no
 *                              sigui la producció de Vercel envia res.
 *
 * Amb el domini verificat a Resend, els correus s'entreguen a qualsevol
 * destinatari. (En mode de proves, Resend només reparteix a la teva pròpia
 * adreça verificada.)
 */
/**
 * Es llegeix a cada enviament, no al carregar el mòdul: així un canvi de
 * variable a l'entorn no queda capturat per una instància ja calenta.
 */
function fromAddress(): string {
  return process.env.NOTIFICATIONS_FROM_EMAIL ?? "onboarding@resend.dev";
}


/**
 * ¿Aquest procés té permís per enviar correus DE VERITAT?
 *
 * Només diu que sí a dos casos:
 *
 *   1. `ALLOW_REAL_EMAILS=true` — la porta explícita, per quan de debò es vol
 *      provar l'enviament des de fora de producció. S'ha d'escriure a mà i es
 *      veu al `.env.local`: ningú l'activa sense saber-ho.
 *   2. Producció de veritat a Vercel.
 *
 * PER QUÈ NO N'HI HA PROU AMB `NODE_ENV`
 *
 * Perquè `next start` —que és el que fa `npm run start`— posa
 * NODE_ENV=production encara que corri en un portàtil. Comprovat: en local dona
 * NODE_ENV=production i VERCEL sense definir. Un tall que només mirés NODE_ENV
 * hauria deixat passar exactament el correu que ens va portar aquí: una prova
 * local que va arribar a una bústia real amb el remitent de proves i el logo
 * apuntant a localhost.
 *
 * El que distingeix de debò és `VERCEL_ENV`, que només existeix quan el codi
 * corre a Vercel. Si algun dia l'app s'allotja en un altre lloc, aquesta
 * variable no hi serà i els correus es tallaran: aleshores cal posar
 * ALLOW_REAL_EMAILS=true a l'entorn de producció nou. Val més que s'aturin i es
 * vegi que no que surtin des d'on no toca.
 */
function realSendAllowed(): boolean {
  if (process.env.ALLOW_REAL_EMAILS === "true") return true;
  return (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "production"
  );
}

export type SendResult = { ok: boolean; error?: string; id?: string };

/** Envia un correu. Mai llança: retorna {ok:false, error} si falla. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** On van les respostes (el correu de contacte del centre). Sense, cap. */
  replyTo?: string | null;
}): Promise<SendResult> {
  // En mode demo mai enviem de veritat: hi ha RESEND_API_KEY en entorns de
  // desenvolupament, i sense aquest tall una alta de prova enviava correus
  // reals (amb el remitent de proves) a bústies reals.
  if (USE_MOCK) return { ok: true, id: "mock" };

  // Fora de producció no s'envia res tret que algú ho demani explícitament.
  // Es torna {ok:false} i no {ok:true}: així queda al `notification_log` com a
  // 'failed' amb el motiu, i no com un enviament que no ha existit.
  if (!realSendAllowed())
    return {
      ok: false,
      error:
        "Enviament bloquejat fora de producció (posa ALLOW_REAL_EMAILS=true si el vols de debò)",
    };

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY no configurada" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: json?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error d'enviament" };
  }
}

/**
 * Resultat d'un lot. Si falla, falla SENCER (Resend valida el lot abans
 * d'enviar-ne cap), i `kind` diu què fer amb els que queden:
 *
 *   · "quota" — s'ha esgotat el límit diari o mensual del pla. Els lots que
 *     venen darrere fallarien igual: no es proven.
 *   · "rate"  — massa peticions per segon (10/s al pla de Resend). Es torna a
 *     provar després d'esperar `retryAfterMs`.
 *   · "other" — qualsevol altra cosa: aquest lot es dona per fallit i es
 *     continua amb el següent.
 */
export type BatchResult =
  | { ok: true; ids: (string | undefined)[] }
  | { ok: false; error: string; kind: "quota" | "rate" | "other"; retryAfterMs?: number };

export type BatchEmail = { to: string; subject: string; html: string; text?: string; replyTo?: string | null };

/** Màxim de correus per crida a /emails/batch (límit de Resend). */
export const RESEND_BATCH_MAX = 100;

/**
 * Envia fins a 100 correus en UNA crida (`POST /emails/batch`). Cada correu
 * compta igual contra el límit diari del pla; el que s'estalvia són crides
 * (el límit de 10 per segon) i temps.
 *
 * `idempotencyKey`: si el mateix lot es torna a enviar amb la mateixa clau en
 * 24 h, Resend no el duplica. Mai llança.
 */
export async function sendEmailBatch(
  emails: BatchEmail[],
  idempotencyKey?: string,
): Promise<BatchResult> {
  if (emails.length === 0) return { ok: true, ids: [] };
  if (emails.length > RESEND_BATCH_MAX)
    return { ok: false, kind: "other", error: `Lot de ${emails.length} correus: el màxim és ${RESEND_BATCH_MAX}` };
  if (USE_MOCK) return { ok: true, ids: emails.map(() => "mock") };
  if (!realSendAllowed())
    return {
      ok: false,
      kind: "other",
      error: "Enviament bloquejat fora de producció (posa ALLOW_REAL_EMAILS=true si el vols de debò)",
    };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, kind: "other", error: "RESEND_API_KEY no configurada" };

  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(
        emails.map((e) => ({
          from: fromAddress(),
          to: e.to,
          subject: e.subject,
          html: e.html,
          ...(e.text ? { text: e.text } : {}),
          ...(e.replyTo ? { reply_to: e.replyTo } : {}),
        })),
      ),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, ...classifyResendError(res.status, body, res.headers.get("retry-after")) };
    }
    const json = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
    return { ok: true, ids: emails.map((_, i) => json?.data?.[i]?.id) };
  } catch (e) {
    return { ok: false, kind: "other", error: e instanceof Error ? e.message : "error d'enviament" };
  }
}

/**
 * Llegeix l'error de Resend. Els de límit tornen 429 amb un `name`:
 * `daily_quota_exceeded` / `monthly_quota_exceeded` (el pla) o
 * `rate_limit_exceeded` (peticions per segon). Exportada per a les proves.
 */
export function classifyResendError(
  status: number,
  body: string,
  retryAfter: string | null,
): { error: string; kind: "quota" | "rate" | "other"; retryAfterMs?: number } {
  let name = "";
  try {
    name = String((JSON.parse(body) as { name?: unknown }).name ?? "");
  } catch {
    // cos que no és JSON
  }
  const raw = `Resend ${status}: ${body.slice(0, 300)}`;
  if (/quota/i.test(name) || (status === 429 && /quota/i.test(body)))
    return {
      kind: "quota",
      error: `Límit ${/monthly/i.test(name + body) ? "mensual" : "diari"} de correus de Resend esgotat · ${raw}`,
    };
  if (status === 429) {
    const secs = Number(retryAfter);
    return { kind: "rate", error: `Massa peticions a Resend · ${raw}`, retryAfterMs: (Number.isFinite(secs) && secs > 0 ? secs : 1) * 1000 };
  }
  return { kind: "other", error: raw };
}
