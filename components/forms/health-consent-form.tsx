"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PendingSubmit } from "@/components/ui/pending-submit";
import {
  grantHealthConsentAction,
  type FormState,
} from "@/app/(client)/client/configuracio/consent-actions";

export function HealthConsentForm() {
  const t = useTranslations("config.privacy");
  const te = useTranslations("config.privacy.errors");
  const [state, formAction] = useActionState(
    grantHealthConsentAction,
    {} as FormState,
  );

  if (state.ok) {
    return (
      <p className="text-sm font-bold text-success">
        {t("ok")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm text-brand-charcoal">
        <input
          type="checkbox"
          name="accept"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
        />
        <span>
          {t.rich("consent", {
            link: (chunks) => (
              <Link
                href="/legal/privacitat"
                target="_blank"
                className="font-bold text-brand-purple hover:text-brand-orange"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      {state.errorCode && (
        <p className="text-sm text-error">{te(state.errorCode)}</p>
      )}
      <div>
        <PendingSubmit
          pendingLabel={t("accepting")}
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark disabled:opacity-60"
        >
          {t("accept")}
        </PendingSubmit>
      </div>
    </form>
  );
}
