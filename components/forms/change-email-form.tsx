"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  requestEmailChangeAction,
  cancelEmailChangeAction,
  type EmailFormState,
} from "@/app/(client)/client/configuracio/email-actions";
import type { PendingEmailChange } from "@/lib/data/email-change";

/**
 * Canvi del correu d'ACCÉS, germà de `ChangePasswordForm` i a la mateixa
 * pestanya.
 *
 * Va aquí i no al formulari de dades personals a posta: no és una dada més del
 * perfil sinó una credencial, el canvi triga dos passos i acaba en una altra
 * bústia. Barrejat entre el telèfon i l'alçada semblaria un camp que es desa
 * amb el botó de sempre, i és justament la confusió que va portar a treure'l
 * d'allà.
 *
 * A diferència del de contrasenya, aquest NO fa la feina al navegador: només
 * envia el formulari. Qui comprova la contrasenya, mira si el correu ja és
 * d'algú i encunya l'enllaç és el servidor.
 */
export function ChangeEmailForm({
  currentEmail,
  pending,
}: {
  currentEmail: string;
  pending: PendingEmailChange | null;
}) {
  const t = useTranslations("config.email");
  const te = useTranslations("config.email.errors");
  const [state, formAction] = useActionState(
    requestEmailChangeAction,
    {} as EmailFormState,
  );

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          {t("title")}
        </h2>
        <p className="mt-1 text-xs text-brand-muted">{t("hint")}</p>
      </div>

      {/* El correu d'ara, per veure'l però no per tocar-lo: el canvi passa pel
          formulari de sota, que és qui demana la contrasenya. */}
      <Field
        label={t("current")}
        name="currentEmail"
        type="email"
        defaultValue={currentEmail}
        disabled
        readOnly
      />

      {pending && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5">
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            {t("pendingTitle")}
          </span>
          <p className="text-sm text-brand-charcoal">
            {t("pending", { email: pending.newEmail })}
          </p>
          <form action={cancelEmailChangeAction}>
            <button
              type="submit"
              className="text-sm font-bold text-brand-purple hover:text-brand-orange"
            >
              {t("cancel")}
            </button>
          </form>
        </div>
      )}

      {state.okEmail ? (
        <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
          {t("ok", { email: state.okEmail })}
        </p>
      ) : (
        <form action={formAction} className="flex max-w-sm flex-col gap-4">
          <Field
            label={t("new")}
            name="newEmail"
            type="email"
            required
            autoComplete="email"
          />
          <div>
            <PasswordField
              label={t("password")}
              name="password"
              autoComplete="current-password"
              required
              showLabel={t("show")}
              hideLabel={t("hide")}
            />
            <p className="mt-1 text-xs text-brand-muted">{t("passwordHint")}</p>
          </div>
          {state.errorCode && (
            <p className="text-sm text-error">{te(state.errorCode)}</p>
          )}
          <div>
            <SubmitButton pendingLabel={t("saving")}>{t("submit")}</SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
