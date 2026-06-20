"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";

/**
 * Alta de cuenta. Al registrarse, el trigger `on_auth_user_created` crea
 * automáticamente la fila en `profiles` con rol 'client' por defecto.
 * Los roles admin/trainer se asignan después manualmente.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Estos datos los lee el trigger handle_new_user().
        data: { full_name: fullName, role: "client" },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Según la config de Supabase, puede requerir confirmación por email.
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
        <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
          <Wordmark className="mb-4 block" />
          <h1 className="text-xl text-brand-dark">Cuenta creada</h1>
          <p className="mt-3 text-sm text-brand-muted">
            Revisa tu correo si la confirmación por email está activada. Después
            podrás{" "}
            <Link
              href="/login"
              className="font-bold text-brand-purple hover:text-brand-orange"
            >
              iniciar sesión
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
      <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col gap-1">
          <Wordmark />
          <h1 className="text-xl text-brand-dark">Crear cuenta</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field
            label="Nombre completo"
            name="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <Field
            label="Correo electrónico"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Field
            label="Contraseña"
            name="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-brand-muted">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
