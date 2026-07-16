"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Canvi de contrasenya per a l'usuari amb sessió oberta. Per seguretat es torna
 * a autenticar amb la contrasenya actual abans d'aplicar la nova (evita que algú
 * amb una sessió oberta sense vigilar la canviï).
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (password.length < 8)
      return setError("La nova contrasenya ha de tenir com a mínim 8 caràcters.");
    if (password !== confirm)
      return setError("Les contrasenyes noves no coincideixen.");
    if (password === current)
      return setError("La nova contrasenya ha de ser diferent de l'actual.");

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) {
      setError("No s'ha pogut identificar el teu compte.");
      setLoading(false);
      return;
    }
    // Reautenticació amb la contrasenya actual.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInErr) {
      setError("La contrasenya actual no és correcta.");
      setLoading(false);
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setCurrent("");
    setPassword("");
    setConfirm("");
    setOk(true);
  }

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Contrasenya
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Canvia la contrasenya del teu compte.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <Field
          label="Contrasenya actual"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="Nova contrasenya"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Repeteix la nova contrasenya"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-sm text-error">{error}</p>}
        {ok && (
          <p className="text-sm text-success">Contrasenya actualitzada.</p>
        )}
        <div>
          <Button type="submit" disabled={loading}>
            {loading ? "Desant…" : "Canviar contrasenya"}
          </Button>
        </div>
      </form>
    </section>
  );
}
