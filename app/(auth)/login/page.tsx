"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import type { UserRole } from "@/types/database";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    );

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Tras el login, llevamos al usuario a su área según el rol.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const redirectedFrom = searchParams.get("redirectedFrom");
    const role = profile?.role as UserRole | undefined;
    router.replace(redirectedFrom ?? (role ? `/${role}` : "/"));
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
      <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col gap-1">
          <Wordmark />
          <h1 className="text-xl text-brand-dark">Iniciar sesión</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-brand-muted">
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
