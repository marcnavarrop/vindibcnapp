"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { roleHome } from "@/lib/auth-redirect";
import type { UserRole } from "@/types/database";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

type Status = "verifying" | "ready" | "invalid";

/**
 * Fixa la contrasenya després d'obrir un enllaç d'invitació o de recuperació.
 * La verificació del token es fa AQUÍ, amb JS (verifyOtp), no en un GET del
 * servidor: així els escànegers d'enllaços del correu (GET sense JS) no
 * consumeixen el token d'un sol ús abans que l'usuari cliqui.
 */
function UpdatePasswordInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const supabase = createClient();
    (async () => {
      // IMPORTANT: si hi ha token a l'enllaç, s'ha de verificar SEMPRE primer.
      // verifyOtp estableix la sessió de l'usuari del token (i substitueix
      // qualsevol sessió que ja hi hagués al navegador, p. ex. la d'un admin),
      // de manera que la contrasenya es fixa a l'usuari correcte.
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      if (tokenHash && type) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        setStatus(vErr ? "invalid" : "ready");
        return;
      }
      // Sense token: només és vàlid si l'usuari ja té una sessió pròpia oberta
      // (p. ex. hi arriba directament per canviar-se la contrasenya).
      const { data: sess } = await supabase.auth.getSession();
      setStatus(sess.session ? "ready" : "invalid");
    })();
  }, [params]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Del DOM, no d'un estat de React: els gestors de contrasenyes poden
    // omplir els camps sense disparar l'onChange. Abans de cap await.
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    setError(null);
    if (password.length < 8)
      return setError("La contrasenya ha de tenir com a mínim 8 caràcters.");
    if (password !== confirm)
      return setError("Les contrasenyes no coincideixen.");

    setLoading(true);
    let navigating = false;

    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }

      const { data } = await supabase.auth.getUser();
      let role: UserRole | undefined;
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        role = profile?.role as UserRole | undefined;
      }

      // Navegació dura: assegura que la petició porti les cookies de sessió i
      // que el middleware no ens reboti cap aquí deixant el botó penjat.
      navigating = true;
      window.location.assign(roleHome(role));
    } catch {
      setError("Hi ha hagut un problema de connexió. Torna-ho a provar.");
    } finally {
      if (!navigating) setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <div className={SHELL}>
        <div className="mb-6 flex flex-col gap-1">
          <Wordmark height={30} />
          <h1 className="text-xl text-brand-dark">Crea la teva contrasenya</h1>
        </div>

        {status === "verifying" ? (
          <p className="text-sm text-brand-muted">Verificant l&apos;enllaç…</p>
        ) : status === "invalid" ? (
          <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            Aquest enllaç no és vàlid o ha caducat. Demana&apos;n un de nou des de{" "}
            <a
              href="/forgot-password"
              className="font-bold text-brand-purple underline"
            >
              restablir la contrasenya
            </a>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Camps no controlats: es llegeixen del FormData al submit. */}
            <PasswordField
              label="Nova contrasenya"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordField
              label="Repeteix la contrasenya"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-error">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Desant…" : "Desar i entrar"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordInner />
    </Suspense>
  );
}
