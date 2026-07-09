"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { recordRegistrationConsentAction } from "@/app/(auth)/register/actions";

/**
 * Alta de cuenta. Al registrarse, el trigger `on_auth_user_created` crea
 * automáticamente la fila en `profiles` con rol 'client' por defecto.
 * Los roles admin/trainer se asignan después manualmente.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptPrivacy) {
      setError(
        "Has d'acceptar la Política de Privacitat i l'Avís Legal per continuar.",
      );
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
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

    // Registra el consentiment de privacitat lligat a l'alta (data + IP).
    if (data.user?.id) {
      try {
        await recordRegistrationConsentAction(data.user.id);
      } catch {
        // No bloquegem l'alta si el registre del consentiment falla; queda
        // marcada pendent i es pot tornar a demanar des de Configuració.
      }
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
          <h1 className="text-xl text-brand-dark">Compte creat</h1>
          <p className="mt-3 text-sm text-brand-muted">
            Revisa el teu correu si la confirmació per email està activada.
            Després podràs{" "}
            <Link
              href="/login"
              className="font-bold text-brand-purple hover:text-brand-orange"
            >
              iniciar sessió
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
          <h1 className="text-xl text-brand-dark">Crear compte</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field
            label="Nom complet"
            name="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="flex items-start gap-2 text-sm text-brand-charcoal">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
            />
            <span>
              He llegit i accepto la{" "}
              <Link
                href="/legal/privacitat"
                target="_blank"
                className="font-bold text-brand-purple hover:text-brand-orange"
              >
                Política de Privacitat
              </Link>{" "}
              i l&apos;{" "}
              <Link
                href="/legal/avis-legal"
                target="_blank"
                className="font-bold text-brand-purple hover:text-brand-orange"
              >
                Avís Legal
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={loading || !acceptPrivacy}>
            {loading ? "Creant…" : "Crear compte"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-brand-muted">
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
        </p>

        <p className="mt-6 text-sm text-brand-muted">
          Ja tens compte?{" "}
          <Link
            href="/login"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            Iniciar sessió
          </Link>
        </p>
      </div>
    </main>
  );
}
