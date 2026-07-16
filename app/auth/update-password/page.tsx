"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { roleHome } from "@/lib/auth-redirect";
import type { UserRole } from "@/types/database";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

/**
 * Fixa la contrasenya després d'obrir un enllaç d'invitació o de recuperació.
 * La sessió ja l'ha establert /auth/callback; aquí només es crida updateUser.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8)
      return setError("La contrasenya ha de tenir com a mínim 8 caràcters.");
    if (password !== confirm)
      return setError("Les contrasenyes no coincideixen.");

    setLoading(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    // Redirigeix a la home del rol.
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
    router.replace(roleHome(role));
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <div className={SHELL}>
        <div className="mb-6 flex flex-col gap-1">
          <Wordmark />
          <h1 className="text-xl text-brand-dark">Crea la teva contrasenya</h1>
        </div>

        {!ready ? (
          <p className="text-sm text-brand-muted">Carregant…</p>
        ) : !hasSession ? (
          <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            Aquest enllaç no és vàlid o ha caducat. Torna a demanar l&apos;accés
            des de{" "}
            <a href="/forgot-password" className="font-bold text-brand-purple underline">
              restablir la contrasenya
            </a>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field
              label="Nova contrasenya"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              label="Repeteix la contrasenya"
              name="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
