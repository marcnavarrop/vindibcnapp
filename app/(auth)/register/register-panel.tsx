"use client";

import { useState } from "react";
import Link from "next/link";
import { TAP } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { USE_MOCK } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { PasswordField } from "@/components/ui/password-field";
import { RequiredNote } from "@/components/ui/required-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import {
  recordRegistrationConsentAction,
  notifyNewRegistrationAction,
  completeRegistrationProfileAction,
  validateRegistrationAction,
  mockRegisterAction,
} from "@/app/(auth)/register/actions";
import type { Gender } from "@/types/database";

const GENDERS: Gender[] = ["home", "dona", "altre", "ns_nc"];

/**
 * Part interactiva de l'alta de compte.
 *
 * Viu separada de la pàgina pel mateix motiu que `LoginPanel`: la pàgina ha de
 * ser un component de SERVIDOR per poder muntar `<BrandPanel />`, que llegeix
 * les traduccions amb `getTranslations`. Aquí dins no hi ha cap canvi de
 * lògica respecte d'abans —els mateixos camps, les mateixes validacions i les
 * mateixes crides—: només s'ha tret l'embolcall visual, que ara el posa la
 * pàgina i és el mateix que el del login.
 *
 * En registrar-se, el trigger `on_auth_user_created` crea la fila a `profiles`
 * amb rol 'client'. Els rols admin/trainer s'assignen després a mà.
 */
export function RegisterPanel() {
  const t = useTranslations("register");
  /*
   * Les etiquetes dels camps nous surten de `config.profile`, que és on ja
   * vivien: són EL MATEIX dada, només canvia quan es demana. Duplicar-les
   * voldria dir que un dia "Contacte d'emergència" es digués diferent segons
   * la pantalla.
   */
  const tp = useTranslations("config.profile");
  const tg = useTranslations("labels.gender");
  const genderOptions = GENDERS.map((g) => ({ value: g, label: tg(g) }));
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
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const fullName = get("fullName");
    const email = get("email");
    const phone = get("phone");
    const password = String(fd.get("password") ?? "");
    const passwordConfirm = String(fd.get("passwordConfirm") ?? "");
    const referralCode = get("referralCode").toUpperCase() || undefined;
    const perfil = {
      phone,
      birthDate: get("birthDate"),
      heightCm: get("heightCm"),
      weightKg: get("weightKg"),
      gender: get("gender"),
      emergencyContact: get("emergencyContact"),
    };

    // Talla aquí, sense enviar res: qui s'equivoca repetint la contrasenya ha
    // de veure-ho a l'instant i no després d'un viatge al servidor.
    if (password !== passwordConfirm) {
      setError(t("errorPasswordMismatch"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // En mode demo no cridem Supabase: crearia un usuari real al projecte.
      if (USE_MOCK) {
        await mockRegisterAction({ fullName, email, referralCode });
        setDone(true);
        return;
      }

      /*
       * El servidor valida ABANS de crear res. Els `required` de l'HTML es
       * desactiven des de la consola del navegador en dues línies; això no.
       * I va abans del `signUp` a posta: si fallés després, quedaria un compte
       * creat a Auth que ningú ha arribat a completar.
       */
      const check = await validateRegistrationAction({
        fullName,
        email,
        phone,
        password,
        passwordConfirm,
      });
      if (check.errorCode) {
        setError(t(`errors.${check.errorCode}`));
        return;
      }

      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Aquestes dades les llegeix el trigger handle_new_user().
          //
          // Aquí NO hi va el rol. Hi anava, i no servia de res: el metadata
          // l'escriu qui fa la petició, així que era una declaració d'intencions
          // que qualsevol podia contradir des de l'endpoint públic. Des de la
          // 0064 el trigger crea sempre un 'client' i ignora el que se li digui.
          data: {
            full_name: fullName,
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
        // Telèfon i la resta de dades del perfil. Van abans dels avisos
        // perquè el correu de benvinguda ja trobi la fitxa completa.
        try {
          await completeRegistrationProfileAction(perfil);
        } catch {
          // No bloqueja l'alta: es poden completar a Configuració.
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

  // L'alta feta es queda DINS de la mateixa composició: abans es pintava una
  // targeta soleta sobre el fons i el panell de marca desapareixia de cop, just
  // al moment en què més sentit té que hi sigui.
  if (done) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-brand-dark sm:text-3xl">
          {t("createdTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-brand-muted">
          {t("createdBody")}{" "}
          <Link
            href="/login"
            className={`font-bold text-brand-purple hover:text-brand-orange ${TAP}`}
          >
            {t("createdSignIn")}
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sense Wordmark: el logotip ja el porta el panell de marca del costat,
          i repetit dues vegades a la mateixa pantalla feia soroll. */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-brand-dark sm:text-3xl">
          {t("title")}
        </h1>
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

        <Field
          label={tp("phone")}
          name="phone"
          type="tel"
          required
          autoComplete="tel"
        />

        <PasswordField
          label={t("password")}
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
        />

        <PasswordField
          label={t("passwordConfirm")}
          name="passwordConfirm"
          required
          minLength={6}
          autoComplete="new-password"
        />

        {/* Dades opcionals. Mateixos camps i mateixos límits que a
            Configuració → Dades personals: és el mateix formulari, només
            canvia quan es demana. Qui no les vulgui donar ara, les té allà. */}
        <fieldset className="flex flex-col gap-5 rounded-xl border border-brand-border p-4">
          <legend className="px-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
            {t("optionalTitle")}
          </legend>

          <Field label={tp("birthDate")} name="birthDate" type="date" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={tp("height")}
              name="heightCm"
              type="number"
              min={50}
              max={260}
            />
            <Field
              label={tp("weight")}
              name="weightKg"
              type="number"
              min={20}
              max={400}
              step="0.1"
            />
          </div>

          <SelectField
            label={tp("gender")}
            name="gender"
            placeholder={tg("ns_nc")}
            options={genderOptions}
          />

          <Field
            label={tp("emergency")}
            name="emergencyContact"
            placeholder={tp("emergencyPlaceholder")}
          />
        </fieldset>

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

        <RequiredNote>{t("requiredNote")}</RequiredNote>

        {error && <p className="text-sm text-error">{error}</p>}

        <Button type="submit" disabled={loading || !acceptPrivacy}>
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="text-sm text-brand-muted">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className={`font-bold text-brand-purple hover:text-brand-orange ${TAP}`}
        >
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
