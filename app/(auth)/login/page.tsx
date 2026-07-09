"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/types/database";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

/** Login simulado: elige un rol y entra sin contraseña (modo demo). */
function MockLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function enter(role: UserRole) {
    document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/; max-age=${60 * 60 * 24 * 7}`;
    const redirectedFrom = searchParams.get("redirectedFrom");
    router.replace(redirectedFrom ?? `/${role}`);
    router.refresh();
  }

  const roles: UserRole[] = ["admin", "trainer", "client"];

  return (
    <div className={SHELL}>
      <div className="mb-6 flex flex-col gap-1">
        <Wordmark />
        <h1 className="text-xl text-brand-dark">Entrar (mode demo)</h1>
      </div>

      <p className="mb-5 rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
        Simulació sense Supabase. Tria amb quin rol vols entrar; les dades són
        d&apos;exemple.
      </p>

      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <Button
            key={role}
            variant={role === "admin" ? "primary" : "outline"}
            onClick={() => enter(role)}
          >
            Entrar com a {ROLE_LABELS[role]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Login real contra Supabase. */
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
    <div className={SHELL}>
      <div className="mb-8 flex flex-col gap-1">
        <Wordmark />
        <h1 className="text-xl text-brand-dark">Iniciar sessió</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          label="Correu electrònic"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Contrasenya"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-error">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Entrant…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-brand-muted">
        No tens compte?{" "}
        <Link
          href="/register"
          className="font-bold text-brand-purple hover:text-brand-orange"
        >
          Crear compte
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <Suspense>{USE_MOCK ? <MockLogin /> : <LoginForm />}</Suspense>
      <footer className="mt-6 text-center text-xs text-brand-muted">
        <Link href="/legal/privacitat" className="hover:text-brand-purple">
          Privacitat
        </Link>{" "}
        ·{" "}
        <Link href="/legal/avis-legal" className="hover:text-brand-purple">
          Avís legal
        </Link>{" "}
        ·{" "}
        <Link href="/legal/cookies" className="hover:text-brand-purple">
          Cookies
        </Link>
      </footer>
    </main>
  );
}
