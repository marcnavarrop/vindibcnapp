import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Aterratge dels enllaços dels emails d'auth de Supabase (invitació i recovery).
 * Verifica el token i estableix la sessió (cookies), i redirigeix on toca
 * (per defecte, a fixar la contrasenya). Suporta el flux modern token_hash +
 * verifyOtp i, com a alternativa, el codi PKCE (exchangeCodeForSession).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Només rutes internes (evita open-redirect).
  const rawNext = searchParams.get("next") ?? "/auth/update-password";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/auth/update-password";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Enllaç no vàlid o caducat. Torna-ho a intentar.")}`,
  );
}
