import "server-only";

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
 *   CENTER_EMAIL            — (opcional) correu general del centre per a avisos.
 *
 * Amb el domini verificat a Resend, els correus s'entreguen a qualsevol
 * destinatari. (En mode de proves, Resend només reparteix a la teva pròpia
 * adreça verificada.)
 */
const FROM = process.env.NOTIFICATIONS_FROM_EMAIL ?? "onboarding@resend.dev";

/** Adreça del centre per als avisos interns (opcional). */
export const CENTER_EMAIL = process.env.CENTER_EMAIL ?? null;

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export type SendResult = { ok: boolean; error?: string };

/** Envia un correu. Mai llança: retorna {ok:false, error} si falla. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
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
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error d'enviament" };
  }
}
