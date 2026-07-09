"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  grantHealthConsentAction,
  type FormState,
} from "@/app/(client)/client/configuracio/consent-actions";

export function HealthConsentForm() {
  const [state, formAction] = useActionState(
    grantHealthConsentAction,
    {} as FormState,
  );

  if (state.ok) {
    return (
      <p className="text-sm font-bold text-success">
        Consentiment de dades de salut registrat. Gràcies.
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
          Accepto el tractament de les meves dades de salut per al seguiment de
          fisioteràpia, d&apos;acord amb la{" "}
          <Link
            href="/legal/privacitat"
            target="_blank"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            Política de Privacitat
          </Link>
          .
        </span>
      </label>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div>
        <button
          type="submit"
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          Acceptar
        </button>
      </div>
    </form>
  );
}
