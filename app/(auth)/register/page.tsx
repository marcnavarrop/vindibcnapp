"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { USE_MOCK } from "@/lib/config";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import {
  recordRegistrationConsentAction,
  notifyNewRegistrationAction,
  mockRegisterAction,
} from "@/app/(auth)/register/actions";

/**
 * Alta de cuenta. Al registrarse, el trigger `on_auth_user_created` crea
 * automáticamente la fila en `profiles` con rol 'client' por defecto.
 * Los roles admin/trainer se asignan después manualmente.
 */
export default function RegisterPage() {
  const t = useTranslations("register");
  const tl = useTranslations("legal");
  /**
   * L'idioma que ja s'està veient és el que s'enviarà amb l'alta.
   *
   * El selector de dalt canvia la pantalla A L'INSTANT (cookie) i, en registrar-se,
   * aquest mateix valor viatja al metadata del signUp perquè el trigger de la
   * 0058 el desi al perfil. Així el que tria abans d'apuntar-se és el que es
   * troba en entrar, sense haver de tornar-ho a dir a Configuració.
   */
  const locale = useLocale() as Locale;
  // Només queda com a estat el que controla la UI (el gate del checkbox);
  // els camps de text es llegeixen del FormData, immunes a l'autocompletat.
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptPrivacy) {
      setError(t("errorPrivacy"));
      return;
    }

    // Abans de qualsevol await: després, currentTarget ja és null.
    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get("fullName") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const referralCode =
      String(fd.get("referralCode") ?? "").trim().toUpperCase() || undefined;

    setLoading(true);
    setError(null);

    try {
      // En mode demo no cridem Supabase: crearia un usuari real al projecte.
      if (USE_MOCK) {
        await mockRegisterAction({ fullName, email, referralCode });
        setDone(true);
        return;
      }

      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Estos datos los lee el trigger handle_new_user().
          data: {
            full_name: fullName,
            role: "client",
            // El llegeix el trigger handle_new_user() (migració 0058).
            preferred_language: LOCALES.includes(locale) ? locale : "ca",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
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
        // Email de benvinguda + avís de nou client (best-effort, no bloqueja).
        try {
          await notifyNewRegistrationAction(referralCode);
        } catch {
          // ignorem: els avisos són secundaris.
        }
      }

      // Según la config de Supabase, puede requerir confirmación por email.
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      // Xarxa de seguretat: el botó mai es queda penjat.
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
        <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
          <Wordmark height={34} className="mb-4" />
          <h1 className="text-xl text-brand-dark">{t("createdTitle")}</h1>
          <p className="mt-3 text-sm text-brand-muted">
            {t("createdBody")}{" "}
            <Link
              href="/login"
              className="font-bold text-brand-purple hover:text-brand-orange"
            >
              {t("createdSignIn")}
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
          <Wordmark height={30} />
          <h1 className="text-xl text-brand-dark">{t("title")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Camps no controlats: els valors surten del FormData al submit. */}
          <Field
            label={t("fullName")}
            name="fullName"
            type="text"
            required
            autoComplete="name"
          />

          <Field
            label={t("email")}
            name="email"
            type="email"
            required
            autoComplete="email"
          />

          <PasswordField
            label={t("password")}
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
          />

          <div className="flex flex-col gap-1">
            <LanguageSwitcher current={locale} label={t("language")} />
            <p className="text-xs text-brand-muted">{t("languageHint")}</p>
          </div>

          {/* `uppercase` només afecta com es veu; el valor es normalitza en
              llegir-lo, sense necessitat d'estat de React. */}
          <Field
            label={t("referral")}
            name="referralCode"
            type="text"
            autoComplete="off"
            className="uppercase"
            placeholder={t("referralPlaceholder")}
          />

          <label className="flex items-start gap-2 text-sm text-brand-charcoal">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
            />
            <span>
              {t("acceptPre")}{" "}
              <Link
                href="/legal/privacitat"
                target="_blank"
                className="font-bold text-brand-purple hover:text-brand-orange"
              >
                {t("privacyPolicy")}
              </Link>{" "}
              {t("acceptMid")}{" "}
              <Link
                href="/legal/avis-legal"
                target="_blank"
                className="font-bold text-brand-purple hover:text-brand-orange"
              >
                {t("legalNotice")}
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={loading || !acceptPrivacy}>
            {loading ? t("submitting") : t("submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-brand-muted">
          <Link href="/legal/privacitat" className="hover:text-brand-purple">
            {tl("privacy")}
          </Link>{" "}
          ·{" "}
          <Link href="/legal/avis-legal" className="hover:text-brand-purple">
            {tl("notice")}
          </Link>{" "}
          ·{" "}
          <Link href="/legal/cookies" className="hover:text-brand-purple">
            Cookies
          </Link>
        </p>

        <p className="mt-6 text-sm text-brand-muted">
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            {t("signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
