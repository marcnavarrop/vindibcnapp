import "server-only";

/**
 * Enviament d'emails best-effort amb Resend. Si `RESEND_API_KEY` no està
 * configurada, no fa res (mai bloqueja el flux principal). Deixat preparat per
 * activar-lo només posant la variable d'entorn.
 */
const FROM = process.env.RESEND_FROM ?? "VindiBCN <onboarding@resend.dev>";
/** Adreça del centre per als avisos interns (opcional). */
export const CENTER_EMAIL = process.env.CENTER_EMAIL ?? null;

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // No configurat: silenciós, no bloqueja.
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });
  } catch {
    // Best-effort: un error d'enviament no ha de tombar l'operació.
  }
}
