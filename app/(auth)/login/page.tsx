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
import { safeRedirect } from "@/lib/auth-redirect";
import type { UserRole } from "@/types/database";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

/** Login simulado: elige un rol y entra sin contraseña (modo demo). */
function MockLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function enter(role: UserRole) {
    document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/; max-age=${60 * 60 * 24 * 7}`;
    // Torna al destí original si és segur i el rol hi té accés; si no, a la home.
    router.replace(safeRedirect(searchParams.get("redirectedFrom"), role));
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
  const searchParams = useSearchParams();
  // Missatge d'error que pot arribar del callback (enllaç caducat, etc.).
  const [error, setError] = useState<string | null>(
    searchParams.get("error"),
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Els valors surten del DOM, no d'un estat de React: l'autocompletat natiu
    // d'iOS/Safari pot omplir els camps sense disparar l'onChange que React
    // necessita, i llavors enviaríem cadenes buides amb els camps plens.
    // Cal llegir-ho ABANS del primer await: després, currentTarget ja és null.
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    setLoading(true);
    setError(null);

    // Si sortim de la pàgina, no volem reactivar el botó: ha de continuar
    // dient "Entrant…" fins que el navegador descarregui la pàgina.
    let navigating = false;

    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        return;
      }
      if (!data.user) {
        setError("No s'ha pogut iniciar la sessió. Torna-ho a provar.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const role = profile?.role as UserRole | undefined;
      // Torna al destí original si és segur i el rol hi té accés; si no, a la home.
      const dest = safeRedirect(searchParams.get("redirectedFrom"), role);

      // Navegació dura a propòsit, en lloc de router.replace() + refresh():
      // garanteix que la petició porti les cookies de sessió acabades d'escriure.
      // Amb una navegació de client, el middleware pot no veure-les encara i
      // rebotar cap a /login; com que és la MATEIXA ruta, el component no es
      // desmuntaria i el botó es quedaria penjat a "Entrant…" per sempre.
      navigating = true;
      window.location.assign(dest);
    } catch {
      setError("Hi ha hagut un problema de connexió. Torna-ho a provar.");
    } finally {
      // Xarxa de seguretat: passi el que passi, el botó no es queda penjat.
      if (!navigating) setLoading(false);
    }
  }

  return (
    <div className={SHELL}>
      <div className="mb-8 flex flex-col gap-1">
        <Wordmark />
        <h1 className="text-xl text-brand-dark">Iniciar sessió</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Camps no controlats: sense estat de React no hi pot haver desajust
            amb l'autocompletat. Els valors es llegeixen del FormData al submit. */}
        <Field
          label="Correu electrònic"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          label="Contrasenya"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />

        {error && <p className="text-sm text-error">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Entrant…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-brand-muted">
        <Link
          href="/forgot-password"
          className="font-bold text-brand-purple hover:text-brand-orange"
        >
          Has oblidat la contrasenya?
        </Link>
      </p>

      <p className="mt-2 text-sm text-brand-muted">
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
      <Link
        href="/prova"
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-bold text-brand-purple hover:border-brand-purple"
      >
        🎁 Vols provar-nos? Demana una sessió de prova gratuïta
      </Link>
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
