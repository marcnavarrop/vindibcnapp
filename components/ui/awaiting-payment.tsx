"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

/**
 * "Estem confirmant el pagament."
 *
 * Existeix per una decisió de fons: qui crea el bo o el val és el webhook de
 * Stripe, no aquesta pàgina. Quan el client torna del pagament, l'avís de
 * Stripe pot no haver arribat encara —normalment triga un segon o dos—, i la
 * pàgina no es pot inventar res pel seu compte: només pot esperar i tornar a
 * mirar.
 *
 * L'alternativa seria que la pantalla de tornada creés la compra ella mateixa,
 * i llavors n'hi hauria prou amb escriure l'URL d'èxit a mà per regalar-se un
 * bo. Val més la pena l'espera de dos segons.
 */
export function AwaitingPayment({
  title = "Estem confirmant el pagament",
  hint = "Un moment: el banc ens ho està confirmant. No cal que facis res.",
  /** On tornar si passa massa estona. */
  fallbackHref,
  fallbackLabel,
}: {
  title?: string;
  hint?: string;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  // Cada dos segons fins a un minut. Passat aquest temps es deixa de mirar:
  // insistir eternament no arregla res i deixaria la pestanya donant voltes.
  const gaveUp = tries >= 30;

  useEffect(() => {
    if (gaveUp) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 2000);
    return () => clearTimeout(t);
  }, [tries, gaveUp, router]);

  if (gaveUp)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
        <p className="text-lg font-bold text-brand-dark">
          El pagament està trigant a confirmar-se
        </p>
        <p className="max-w-sm text-sm text-brand-muted">
          Si el banc t&apos;ha cobrat, ho veuràs aparèixer sol en poca estona.
          Si passa una hora i segueix sense sortir-hi, avisa el centre i ho
          mirem: no cal que tornis a pagar.
        </p>
        <Link
          href={fallbackHref}
          className="mt-2 inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          {fallbackLabel}
        </Link>
      </div>
    );

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center"
      aria-live="polite"
      aria-busy
    >
      <Spinner size={28} />
      <p className="text-lg font-bold text-brand-dark">{title}</p>
      <p className="max-w-sm text-sm text-brand-muted">{hint}</p>
    </div>
  );
}
