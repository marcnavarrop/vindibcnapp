"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { confirmEmailChangeAction } from "@/app/auth/confirm-email/actions";

const SHELL =
  "w-full max-w-sm rounded-2xl border border-brand-border bg-white p-8 shadow-sm";

type Status = "verifying" | "ok" | "invalid";

/**
 * Acaba el canvi del correu d'accés.
 *
 * La confirmació la dispara JAVASCRIPT, no un GET del servidor, i és tota la
 * gràcia de la pàgina: els escànegers d'enllaços dels proveïdors de correu fan
 * un GET pla sense executar JS, així que arribar aquí no consumeix res. Sense
 * això, el botó del correu quedaria gastat abans que la persona el pogués
 * prémer —i, pitjor que a la recuperació, el canvi s'hauria aplicat sol.
 *
 * El secret de l'adreça no val res per si mateix: qui encunya el token de
 * GoTrue i el gasta és el servidor (`confirmEmailChangeAction`).
 */
function ConfirmEmailInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [email, setEmail] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const secret = params.get("r");
    if (!secret) {
      setStatus("invalid");
      return;
    }
    (async () => {
      const res = await confirmEmailChangeAction(secret);
      if (res.ok) {
        setEmail(res.email);
        setStatus("ok");
      } else {
        setStatus("invalid");
      }
    })();
  }, [params]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <div className={SHELL}>
        <div className="mb-6 flex flex-col gap-1">
          <Wordmark height={30} />
          <h1 className="text-xl text-brand-dark">
            Canviar el correu d&apos;accés
          </h1>
        </div>

        {status === "verifying" && (
          <p className="text-sm text-brand-muted">Confirmant…</p>
        )}

        {status === "ok" && (
          <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            Fet. A partir d&apos;ara entra amb <strong>{email}</strong>.
          </p>
        )}

        {status === "invalid" && (
          <p className="rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
            Aquest enllaç ja no és vàlid. Pot ser que hagi caducat, que ja
            l&apos;hagis fet servir o que hagis demanat el canvi una altra
            vegada després. Torna-ho a demanar des de Configuració.
          </p>
        )}

        <p className="mt-6 text-sm text-brand-muted">
          <Link
            href="/login"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            ← Anar a iniciar sessió
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailInner />
    </Suspense>
  );
}
