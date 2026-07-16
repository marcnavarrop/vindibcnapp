"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import {
  requestPasswordResetAction,
  type ForgotState,
} from "@/app/(auth)/forgot-password/actions";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

/** Sol·licitud de restabliment de contrasenya (envia email de recovery). */
export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    {} as ForgotState,
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <div className={SHELL}>
        <div className="mb-6 flex flex-col gap-1">
          <Wordmark />
          <h1 className="text-xl text-brand-dark">Restablir la contrasenya</h1>
        </div>

        {state.ok ? (
          <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            Si hi ha un compte amb aquest correu, t&apos;hem enviat un enllaç per
            crear una contrasenya nova. Revisa la teva safata d&apos;entrada.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-5">
            <p className="text-sm text-brand-muted">
              Introdueix el teu correu i t&apos;enviarem un enllaç per crear una
              contrasenya nova.
            </p>
            <Field
              label="Correu electrònic"
              name="email"
              type="email"
              required
            />
            {state.error && <p className="text-sm text-error">{state.error}</p>}
            <Button type="submit">Enviar enllaç</Button>
          </form>
        )}

        <p className="mt-6 text-sm text-brand-muted">
          <Link
            href="/login"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            ← Tornar a iniciar sessió
          </Link>
        </p>
      </div>
    </main>
  );
}
