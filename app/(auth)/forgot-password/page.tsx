"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/wordmark";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field } from "@/components/ui/input";
import {
  requestPasswordResetAction,
  type ForgotState,
} from "@/app/(auth)/forgot-password/actions";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

/** Sol·licitud de restabliment de contrasenya (envia email de recovery). */
export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    {} as ForgotState,
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <div className={SHELL}>
        <div className="mb-6 flex flex-col gap-1">
          <Wordmark height={30} />
          <h1 className="text-xl text-brand-dark">{t("title")}</h1>
        </div>

        {state.ok ? (
          <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            {t("sent")}
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-5">
            <p className="text-sm text-brand-muted">{t("intro")}</p>
            <Field
              label={t("email")}
              name="email"
              type="email"
              required
              autoComplete="email"
            />
            {/* L'acció torna un CODI, no una frase: qui sap l'idioma és la
                pantalla, no el servidor. Mateix criteri que la sessió de prova. */}
            {state.errorCode && (
              <p className="text-sm text-error">{t("errorBadEmail")}</p>
            )}
            <SubmitButton pendingLabel={t("submitting")}>
              {t("submit")}
            </SubmitButton>
          </form>
        )}

        <p className="mt-6 text-sm text-brand-muted">
          <Link
            href="/login"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            {t("back")}
          </Link>
        </p>
      </div>
    </main>
  );
}
