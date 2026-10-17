"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  confirmWelcomeNoticeAction,
  type WelcomeNoticeState,
} from "@/app/actions/welcome-notice-actions";

/**
 * Primer accés d'un client que no s'ha registrat ell (0124): la política de
 * privacitat i les novetats per correu, el mateix que diu el registre. Es queda
 * a l'Inici fins que prem «D'acord».
 */
export function WelcomeNotice({ showPrivacy, showCommunity }: { showPrivacy: boolean; showCommunity: boolean }) {
  const t = useTranslations("home.welcomeNotice");
  const [state, action, pending] = useActionState(confirmWelcomeNoticeAction, {} as WelcomeNoticeState);
  const [receive, setReceive] = useState(true);

  if (!state.ok && !showPrivacy && !showCommunity) return null;
  if (state.ok)
    return (
      <p role="status" className="rounded-2xl border border-success/30 bg-success-bg p-4 text-sm text-success" data-welcome-notice="done">
        {t("done")}
      </p>
    );

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-4 text-sm text-brand-charcoal sm:p-5"
      data-welcome-notice="pending"
    >
      <h2 className="text-base font-bold text-brand-dark">{t("title")}</h2>
      {showPrivacy && (
        <p data-welcome-privacy>
          {t.rich("privacy", {
            privacy: (chunks) => (
              <Link href="/legal/privacitat" target="_blank" className="font-bold text-brand-purple underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
      <form action={action} className="flex flex-col gap-3">
        {showCommunity && (
          <div className="flex flex-col gap-1 rounded-lg bg-brand-bg px-3 py-2.5" data-welcome-community>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="communityEmail"
                checked={receive}
                onChange={(e) => setReceive(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
              />
              <span>{t("communityOptIn")}</span>
            </label>
            <p className="pl-6 text-xs text-brand-muted">{t("communityNote")}</p>
          </div>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-error">
            {t(state.error === "unauthorized" ? "errorUnauthorized" : "errorFailed")}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-brand-purple px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light disabled:opacity-60"
        >
          {pending ? t("saving") : t("ok")}
        </button>
      </form>
    </section>
  );
}
