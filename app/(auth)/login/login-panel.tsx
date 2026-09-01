"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { RequiredMark } from "@/components/ui/required-mark";
import { ROLE_LABELS } from "@/lib/labels";
import { safeRedirect } from "@/lib/auth-redirect";
import type { UserRole } from "@/types/database";

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

/** Login simulado: elige un rol y entra sin contraseña (modo demo). */
function MockLogin() {
  const t = useTranslations("login");
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-brand-dark sm:text-3xl">
          {t("demoTitle")}
        </h1>
        <p className="text-sm text-brand-muted">{t("demoSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <Button
            key={role}
            variant={role === "admin" ? "primary" : "outline"}
            onClick={() => enter(role)}
          >
            {t("demoEnterAs", { role: ROLE_LABELS[role] })}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Login real contra Supabase. */
function LoginForm({ trialCta }: { trialCta?: React.ReactNode }) {
  const t = useTranslations("login");
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
        setError(t("errorNoSession"));
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
      setError(t("errorConnection"));
    } finally {
      // Xarxa de seguretat: passi el que passi, el botó no es queda penjat.
      if (!navigating) setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-brand-dark sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-relaxed text-brand-muted">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Camps no controlats: sense estat de React no hi pot haver desajust
            amb l'autocompletat. Els valors es llegeixen del FormData al submit. */}
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor="email" className="font-medium text-brand-charcoal">
            {t("email")}
            <RequiredMark />
          </label>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-muted"
            >
              <MailIcon />
            </span>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              className="w-full rounded-xl border border-brand-border bg-white py-2.5 pr-3 pl-10 text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </div>
        </div>

        <PasswordField
          label={t("password")}
          name="password"
          required
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          icon={<LockIcon />}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-purple hover:text-brand-orange"
          >
            {t("forgot")}
          </Link>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-orange px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? t("submitting") : t("submit")}
        </button>

        <Link
          href="/register"
          className="w-full rounded-xl border border-brand-orange px-4 py-3 text-center text-sm font-bold text-brand-orange transition-colors hover:bg-brand-orange/5"
        >
          {t("createAccount")}
        </Link>

        {trialCta}
      </form>
    </div>
  );
}

/**
 * Part interactiva del login. Viu separada de la pàgina perquè la pàgina ha de
 * ser un component de servidor: necessita llegir la configuració del centre
 * per decidir si ensenya la crida a la sessió de prova.
 *
 * `trialCta` arriba com a prop i no s'importa aquí perquè és un component de
 * servidor (llegeix la configuració): la pàgina el renderitza i el passa fet.
 */
export function LoginPanel({ trialCta }: { trialCta?: React.ReactNode }) {
  return (
    <Suspense>
      {USE_MOCK ? <MockLogin /> : <LoginForm trialCta={trialCta} />}
    </Suspense>
  );
}
