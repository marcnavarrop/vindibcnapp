"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PendingSubmit } from "@/components/ui/pending-submit";
import {
  grantHealthConsentAction,
  type FormState,
} from "@/app/(client)/client/configuracio/consent-actions";

/**
 * La casella del consentiment de salut. `current`: el client ja té la versió
 * vigent i no cal la casella. El component es queda muntat igualment: si
 * l'acaba d'acceptar, la pàgina es refresca (i passa a `current`) i el missatge
 * de confirmació no ha de desaparèixer amb ella.
 */
export function HealthConsentForm({ current = false }: { current?: boolean } = {}) {
  const t = useTranslations("config.privacy");
  const te = useTranslations("config.privacy.errors");
  const [state, formAction] = useActionState(
    grantHealthConsentAction,
    {} as FormState,
  );

  if (state.ok && current) {
    return (
      <p role="status" className="text-sm font-bold text-success">
        {t("ok")}
      </p>
    );
  }
  if (current) return null;

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
                className="font-bold text-brand-purple hover:text-brand-purple-dark hover:underline"
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
